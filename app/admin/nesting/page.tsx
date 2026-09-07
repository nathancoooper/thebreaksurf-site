'use client';

import { useEffect, useRef, useState } from 'react';
import { packShelves, type PackResult } from '@/lib/binPacking';
import { DTF_ROLL_WIDTH_CM, tierForMeters } from '@/lib/dtfPricing';

interface Design {
  id: string;
  garmentName: string;
  printType: string;
  color: string;
  imagePath: string;
  widthCm: number;
  heightCm: number;
}

interface NestingSheetItem { designId: string; qty: number }
interface NestingSheet {
  id: string;
  name: string;
  sheetWidthCm: number;
  items: NestingSheetItem[];
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function designLabel(d: Design) {
  return `${d.garmentName} · ${d.printType} · ${d.color}`;
}

// Canvas pixels per cm — high enough for a crisp preview without being
// wasteful; DTF print files are typically prepared around this range.
const PX_PER_CM = 38;

function fmtArea(cm2: number) {
  return `${cm2.toFixed(0)} cm²`;
}

function fmtMoney(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

// Print resolution for rasterizing vector designs into the exported sheet.
const EXPORT_DPI = 300;
const CM_PER_INCH = 2.54;

// Design tools like Affinity/Illustrator don't reliably render an SVG
// embedded as a nested <image> data URI (SVG-in-SVG) — only raster formats
// work consistently there — so an SVG source gets rasterized to a PNG at
// print resolution first. PNG/JPEG sources are left untouched.
async function toDataUri(url: string, widthCm: number, heightCm: number): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  const isSvg = blob.type === 'image/svg+xml' || url.toLowerCase().endsWith('.svg');
  if (!isSvg) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const blobUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = blobUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((widthCm / CM_PER_INCH) * EXPORT_DPI);
    canvas.height = Math.round((heightCm / CM_PER_INCH) * EXPORT_DPI);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export default function NestingPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetWidthCm, setSheetWidthCm] = useState(String(DTF_ROLL_WIDTH_CM));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PackResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // A saved sheet is just design IDs + quantities + the sheet width — the
  // actual design images live in the Designs library and are only
  // referenced, never duplicated, so saving a sheet is tiny.
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [sheets, setSheets] = useState<NestingSheet[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [sheetDisplayName, setSheetDisplayName] = useState<string | null>(null);
  const [sheetLocked, setSheetLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function loadSheets() {
    setSheetsLoading(true);
    fetch('/api/admin/nesting-sheets', { credentials: 'include' })
      .then(r => r.json())
      .then(setSheets)
      .finally(() => setSheetsLoading(false));
  }
  useEffect(() => { loadSheets(); }, []);

  function startNewSheet() {
    setEditingSheetId(null);
    setSheetDisplayName(null);
    setSheetLocked(false);
    setSelectedIds([]);
    setQuantities({});
    setSheetWidthCm(String(DTF_ROLL_WIDTH_CM));
    setSaveError(null);
    setView('builder');
  }

  function openSheet(sheet: NestingSheet) {
    setEditingSheetId(sheet.id);
    setSheetDisplayName(sheet.name);
    setSheetLocked(sheet.locked);
    setSheetWidthCm(String(sheet.sheetWidthCm));
    setSelectedIds(sheet.items.map(i => i.designId));
    setQuantities(Object.fromEntries(sheet.items.map(i => [i.designId, String(i.qty)])));
    setSaveError(null);
    setView('builder');
  }

  async function toggleLock(id: string, locked: boolean, e?: React.MouseEvent) {
    e?.stopPropagation();
    const r = await fetch(`/api/admin/nesting-sheets/${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ locked }),
    });
    if (r.ok && editingSheetId === id) setSheetLocked(locked);
    loadSheets();
  }

  async function deleteSheet(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this saved sheet? The designs themselves are unaffected.')) return;
    await fetch(`/api/admin/nesting-sheets/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
    loadSheets();
  }

  async function saveSheet() {
    if (sheetLocked) return;
    const items = designRows.filter(r => r.qty > 0).map(r => ({ designId: r.id, qty: r.qty }));
    if (items.length === 0) { setSaveError('Add at least one design with a quantity.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const body = JSON.stringify({ sheetWidthCm: parseFloat(sheetWidthCm), items });
      const r = editingSheetId
        ? await fetch(`/api/admin/nesting-sheets/${encodeURIComponent(editingSheetId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body })
        : await fetch('/api/admin/nesting-sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body });
      // A non-2xx response isn't guaranteed to have a JSON body (a proxy
      // timeout or an unhandled server exception can return plain text/HTML)
      // — parsing that as JSON would throw and, without this try/catch,
      // leave the button stuck on "Saving…" forever with no explanation.
      let data: { id?: string; name?: string; error?: string } = {};
      try { data = await r.json(); } catch { /* non-JSON response, fall through to the generic error below */ }
      if (!r.ok) { setSaveError(data.error ?? `Failed to save (${r.status}).`); return; }
      setEditingSheetId(data.id ?? null);
      setSheetDisplayName(data.name ?? null);
      loadSheets();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetch('/api/admin/designs', { credentials: 'include' })
      .then(r => r.json())
      .then(setDesigns)
      .finally(() => setLoading(false));
  }, []);

  function setQty(id: string, value: string) {
    setQuantities(prev => ({ ...prev, [id]: value }));
  }

  function addDesign(id: string) {
    if (!id || selectedIds.includes(id)) return;
    setSelectedIds(prev => [...prev, id]);
    setQuantities(prev => ({ ...prev, [id]: prev[id] ?? '1' }));
  }

  function removeDesign(id: string) {
    setSelectedIds(prev => prev.filter(x => x !== id));
  }

  // Live-repack on every change — packing is cheap, so the preview can just
  // always reflect the current selection instead of needing an explicit
  // "pack" action.
  useEffect(() => {
    const width = parseFloat(sheetWidthCm);
    if (!(width > 0)) { setResult(null); return; }

    const byId = new Map(designs.map(d => [d.id, d]));
    const items = selectedIds.flatMap(id => {
      const design = byId.get(id);
      const qty = parseInt(quantities[id] ?? '0', 10);
      if (!design || !(qty > 0)) return [];
      return Array.from({ length: qty }, (_, i) => ({ id: `${id}::${i}`, widthCm: design.widthCm, heightCm: design.heightCm }));
    });

    if (items.length === 0) { setResult(null); return; }
    setResult(packShelves(items, width));
  }, [selectedIds, quantities, sheetWidthCm, designs]);

  useEffect(() => {
    if (!result || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = result.sheetWidthCm * PX_PER_CM;
    canvas.height = result.sheetHeightCm * PX_PER_CM;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const byDesignId = new Map(designs.map(d => [d.id, d]));
    const images = new Map<string, HTMLImageElement>();

    let loaded = 0;
    const uniqueDesignIds = new Set(result.placed.map(p => p.id.split('::')[0]));
    if (uniqueDesignIds.size === 0) return;

    for (const designId of uniqueDesignIds) {
      const design = byDesignId.get(designId);
      if (!design) continue;
      const img = new Image();
      img.onload = () => {
        images.set(designId, img);
        loaded++;
        if (loaded === uniqueDesignIds.size) draw();
      };
      img.src = design.imagePath;
    }

    function draw() {
      if (!ctx) return;
      for (const piece of result!.placed) {
        const designId = piece.id.split('::')[0];
        const img = images.get(designId);
        if (!img) continue;
        ctx.drawImage(img, piece.x * PX_PER_CM, piece.y * PX_PER_CM, piece.widthCm * PX_PER_CM, piece.heightCm * PX_PER_CM);
      }
    }
  }, [result, designs]);

  async function downloadSvg() {
    if (!result) return;
    setExporting(true);
    try {
      const byDesignId = new Map(designs.map(d => [d.id, d]));
      const uniqueDesignIds = [...new Set(result.placed.map(p => p.id.split('::')[0]))];
      const dataUris = new Map<string, string>();
      await Promise.all(uniqueDesignIds.map(async id => {
        const design = byDesignId.get(id);
        if (!design) return;
        dataUris.set(id, await toDataUri(design.imagePath, design.widthCm, design.heightCm));
      }));

      // Every placement gets its own full inline <image> — a <defs>/<use>
      // version that embedded each design once and referenced it per
      // placement was tried, but Affinity's SVG importer doesn't support
      // <use> re-instancing an external <defs> element at all: it just
      // rendered the raw <defs> content once, in place, and silently
      // dropped every <use>. Firefox rendered that version perfectly fine,
      // which is what made it easy to miss — Affinity is the tool this
      // actually needs to work in, so full duplication (larger files) is
      // the accepted tradeoff over an approach that's "correct" SVG but
      // doesn't work in the target app.
      const images = result.placed.map(piece => {
        const designId = piece.id.split('::')[0];
        const href = dataUris.get(designId);
        if (!href) return '';
        // Both href and xlink:href — modern browsers only need the former,
        // but design tools like Affinity/Illustrator still only recognise
        // the older xlink:href and silently render a zero-size image
        // without it.
        return `<image href="${href}" xlink:href="${href}" x="${piece.x}" y="${piece.y}" width="${piece.widthCm}" height="${piece.heightCm}" preserveAspectRatio="none" />`;
      }).join('\n');

      // No background rect — a DTF print file should only lay down ink
      // where the artwork actually is, not a solid sheet behind it.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${result.sheetWidthCm}cm" height="${result.sheetHeightCm}cm" viewBox="0 0 ${result.sheetWidthCm} ${result.sheetHeightCm}">
${images}
</svg>`;

      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `dtf-sheet-${new Date().toISOString().slice(0, 10)}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  // Every added design gets its own row here (not just ones that ended up
  // placed), computed straight from the live quantity input rather than the
  // packing result — keeps the numbers responsive to typing without waiting
  // on a re-pack.
  const designRows = selectedIds.flatMap(id => {
    const d = designs.find(x => x.id === id);
    if (!d) return [];
    const qty = parseInt(quantities[id] ?? '0', 10) || 0;
    const areaCm2 = qty * d.widthCm * d.heightCm;
    return [{ id, design: d, qty, areaCm2 }];
  });

  const usedArea = designRows.reduce((sum, r) => sum + r.areaCm2, 0);

  // Rolls are bought in whole metres, so the length actually paid for is
  // rounded up from whatever the packed layout needs — that rounding
  // slack is real, purchased-but-unused length, on top of any gaps left
  // between pieces on the sheet itself.
  const lengthNeededM = result ? result.sheetHeightCm / 100 : 0;
  const metersOrdered = Math.ceil(lengthNeededM);
  const tier = result ? tierForMeters(metersOrdered) : null;
  const totalCost = tier ? metersOrdered * tier.pricePerMeter : 0;
  const purchasedAreaCm2 = metersOrdered * 100 * (parseFloat(sheetWidthCm) || 0);
  // Derived from the real total rather than the tier rate directly, so the
  // per-row costs always sum exactly to what you'd actually pay.
  const pricePerCm2 = purchasedAreaCm2 > 0 ? totalCost / purchasedAreaCm2 : 0;
  const unusedArea = purchasedAreaCm2 - usedArea;
  const hasPrice = pricePerCm2 > 0;

  if (view === 'list') {
    return (
      <div className="p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">DTF Nesting</h1>
            <p className="text-sm text-gray-400">Saved sheets — pack designs onto a sheet, then export it.</p>
          </div>
          <a
            href="https://dtf.uk/products/build-a-dtf-gang-sheet-online"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Order from DTF.UK
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17 17 7M7 7h10v10"/></svg>
          </a>
        </div>

        {sheetsLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            <button
              onClick={startNewSheet}
              className="flex h-full min-h-[132px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
            >
              + New sheet
            </button>
            {sheets.map(sheet => {
              const totalQty = sheet.items.reduce((sum, i) => sum + i.qty, 0);
              return (
                <button
                  key={sheet.id}
                  onClick={() => openSheet(sheet)}
                  className="group/card relative rounded-2xl border border-gray-100 bg-white p-5 text-left hover:border-gray-300 transition-colors"
                >
                  <p className="truncate pr-10 text-sm font-medium text-gray-900">{sheet.name}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {sheet.items.length} design{sheet.items.length !== 1 ? 's' : ''} · {totalQty} piece{totalQty !== 1 ? 's' : ''}
                  </p>
                  <p className="mt-3 text-[11px] text-gray-300">{fmtDate(sheet.updatedAt)}</p>
                  <div className="absolute right-3 top-3 flex items-center gap-1">
                    <span
                      onClick={e => toggleLock(sheet.id, !sheet.locked, e)}
                      title={sheet.locked ? 'Unlock sheet' : 'Lock sheet'}
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition-opacity hover:bg-gray-50 hover:text-gray-700 ${
                        sheet.locked ? 'text-gray-400 opacity-100' : 'text-gray-300 opacity-0 group-hover/card:opacity-100'
                      }`}
                    >
                      {sheet.locked ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.75-1.5"/></svg>
                      )}
                    </span>
                    <span
                      onClick={e => deleteSheet(sheet.id, e)}
                      title="Delete sheet"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-gray-300 opacity-0 shadow transition-opacity hover:bg-gray-50 hover:text-red-600 group-hover/card:opacity-100"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">DTF Nesting</h1>
          <p className="text-sm text-gray-400">Pack designs onto a sheet, then export it — everything below runs in your browser.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Back to sheets
          </button>
          <a
            href="https://dtf.uk/products/build-a-dtf-gang-sheet-online"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Order from DTF.UK
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17 17 7M7 7h10v10"/></svg>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-[640px_1fr] gap-6">
        {/* Left: setup */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Sheet</p>
              {sheetLocked && (
                <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                  Locked
                </span>
              )}
            </div>
            <div className="mb-3">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Name</span>
              <p className="text-sm text-gray-700">{sheetDisplayName ?? 'Assigned automatically when saved'}</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Width (cm)</span>
              <input type="number" min="0" step="0.1" value={sheetWidthCm} onChange={e => setSheetWidthCm(e.target.value)} disabled={sheetLocked}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400" />
              <span className="mt-1 block text-xs text-gray-400">Defaults to the {DTF_ROLL_WIDTH_CM}cm roll width.</span>
            </label>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={saveSheet} disabled={saving || sheetLocked}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors">
                {saving ? 'Saving…' : editingSheetId ? 'Update sheet' : 'Save sheet'}
              </button>
              {editingSheetId && (
                <button onClick={() => toggleLock(editingSheetId, !sheetLocked)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  {sheetLocked ? 'Unlock' : 'Lock'}
                </button>
              )}
              {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            </div>
          </div>

          {result && tier && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Pricing</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Length needed</span>
                  <span className="text-gray-900">{lengthNeededM.toFixed(2)} m</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Rounded up to</span>
                  <span className="text-gray-900">{metersOrdered} m</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Tier</span>
                  <span className="text-gray-900">{metersOrdered}m {tier.label ? `· ${tier.label}` : ''} · {fmtMoney(tier.pricePerMeter)}/m</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{fmtMoney(totalCost)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Designs & quantities</p>
            {loading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : designs.length === 0 ? (
              <p className="text-sm text-gray-400">No designs yet — add some in the Designs library first.</p>
            ) : (
              <div className="space-y-3">
                {designRows.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-gray-100">
                    <div className={`grid ${hasPrice ? 'grid-cols-[28px_1fr_50px_70px_70px_20px]' : 'grid-cols-[28px_1fr_50px_70px_20px]'} items-center gap-2 border-b border-gray-100 bg-gray-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400`}>
                      <span />
                      <span>Design</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Area</span>
                      {hasPrice && <span className="text-right">Cost</span>}
                      <span />
                    </div>
                    {designRows.map(r => (
                      <div key={r.id} className={`grid ${hasPrice ? 'grid-cols-[28px_1fr_50px_70px_70px_20px]' : 'grid-cols-[28px_1fr_50px_70px_20px]'} items-center gap-2 border-b border-gray-50 px-2 py-1.5 last:border-b-0`}>
                        <img src={r.design.imagePath} alt="" className="h-6 w-6 shrink-0 rounded border border-gray-100 object-contain bg-gray-50" />
                        <span className="min-w-0">
                          <p className="truncate text-xs font-medium text-gray-900">{r.design.garmentName}</p>
                          <p className="truncate text-[11px] text-gray-400">{r.design.printType} · {r.design.color}</p>
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={quantities[r.id] ?? ''}
                          onChange={e => setQty(r.id, e.target.value)}
                          placeholder="0"
                          disabled={sheetLocked}
                          className="w-full min-w-0 rounded border border-gray-200 px-1 py-1 text-right text-xs text-gray-700 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                        />
                        <span className="text-right text-xs text-gray-500">{fmtArea(r.areaCm2)}</span>
                        {hasPrice && <span className="text-right text-xs font-medium text-gray-900">{fmtMoney(r.areaCm2 * pricePerCm2)}</span>}
                        <button onClick={() => removeDesign(r.id)} title="Remove" disabled={sheetLocked} className="text-gray-300 hover:text-gray-500 disabled:opacity-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                    {result && (
                      <div className={`grid ${hasPrice ? 'grid-cols-[28px_1fr_50px_70px_70px_20px]' : 'grid-cols-[28px_1fr_50px_70px_20px]'} items-center gap-2 bg-gray-50 px-2 py-1.5`}>
                        <span />
                        <span className="truncate text-xs text-gray-400">Unused space</span>
                        <span className="text-right text-xs text-gray-400">N/A</span>
                        <span className="text-right text-xs text-gray-400">{fmtArea(unusedArea)}</span>
                        {hasPrice && <span className="text-right text-xs font-medium text-gray-400">{fmtMoney(unusedArea * pricePerCm2)}</span>}
                        <span />
                      </div>
                    )}
                  </div>
                )}

                {!sheetLocked && designs.filter(d => !selectedIds.includes(d.id)).length > 0 && (
                  <select
                    value=""
                    onChange={e => addDesign(e.target.value)}
                    className="w-full rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-500 hover:border-gray-300 focus:border-gray-400 focus:outline-none"
                  >
                    <option value="">+ Add design</option>
                    {designs.filter(d => !selectedIds.includes(d.id)).map(d => (
                      <option key={d.id} value={d.id}>{designLabel(d)}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: layout preview — this column is 1fr, so it always fills to
            the same right edge as the header row (where the DTF.UK button
            sits), at any viewport width. */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Layout</p>
              {result && (
                <button onClick={downloadSvg} disabled={exporting} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  {exporting ? 'Exporting…' : 'Download SVG'}
                </button>
              )}
            </div>
            {!result ? (
              <p className="text-sm text-gray-400">Add a design and set a quantity to see the layout.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-3">
                <canvas ref={canvasRef} className="max-w-full" style={{ width: `${Math.min(result.sheetWidthCm * PX_PER_CM, 700)}px` }} />
              </div>
            )}
            {result && (
              <p className="mt-2 text-xs text-gray-400">{result.sheetWidthCm} × {result.sheetHeightCm.toFixed(1)} cm sheet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
