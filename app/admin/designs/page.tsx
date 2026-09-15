'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Unit = 'mm' | 'cm' | 'm';
const UNIT_IN_CM: Record<Unit, number> = { mm: 0.1, cm: 1, m: 100 };
const UNIT_STEP: Record<Unit, number> = { mm: 1, cm: 0.1, m: 0.001 };

// Sizes are stored in cm; show them in whichever unit reads best.
function fmtSize(widthCm: number, heightCm: number): string {
  const trim = (n: number) => String(Number(n.toFixed(2)));
  const longest = Math.max(widthCm, heightCm);
  if (longest >= 100) return `${trim(widthCm / 100)} x ${trim(heightCm / 100)} m`;
  if (longest < 1) return `${trim(widthCm * 10)} x ${trim(heightCm * 10)} mm`;
  return `${trim(widthCm)} x ${trim(heightCm)} cm`;
}

interface Design {
  id: string;
  garmentName: string;
  printType: string;
  color: string;
  imagePath: string;
  sourcePath?: string;
  widthCm: number;
  heightCm: number;
  createdAt: string;
}

function AddDesignModal({ onClose, onCreated }: { onClose: () => void; onCreated: (design: Design) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [garmentName, setGarmentName] = useState('');
  const [printType, setPrintType] = useState('');
  const [color, setColor] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [unit, setUnit] = useState<'mm' | 'cm' | 'm'>('cm');
  // Image's natural (pixel) aspect ratio — once known, typing either
  // dimension fills in the other so the two always stay proportional to
  // the actual artwork instead of needing to be worked out by hand.
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // EPS/AI/PDF can't be drawn by the browser, so it is rasterised server-side.
  const [isVector, setIsVector] = useState(false);
  const [measuring, setMeasuring] = useState(false);

  async function pickFile(f: File) {
    setFile(f);
    setAspectRatio(null);
    setError(null);
    const vector = /\.(eps|ai|ps|pdf)$/i.test(f.name);
    setIsVector(vector);

    if (vector) {
      // The browser cannot decode EPS/AI/PDF, so ask the server for a low-res
      // raster of it: that gives both the preview and the proportions needed
      // to fill in the other print dimension.
      setPreview(null);
      setMeasuring(true);
      try {
        const form = new FormData();
        form.append('file', f);
        const res = await fetch('/api/admin/artwork-preview', { method: 'POST', credentials: 'include', body: form });
        const data = await res.json().catch(() => null);
        if (!res.ok) { setError(data?.error ?? "Couldn't read that file."); return; }
        if (data?.preview) setPreview(data.preview);
        if (data?.width > 0 && data?.height > 0) setAspectRatio(data.width / data.height);
      } finally {
        setMeasuring(false);
      }
      return;
    }

    const url = URL.createObjectURL(f);
    setPreview(url);

    if (/\.svg$/i.test(f.name)) {
      // An SVG with width="100%" reports no natural size, so fall back to its
      // viewBox for the proportions.
      const text = await f.text().catch(() => '');
      const box = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      if (box && Number(box[1]) > 0 && Number(box[2]) > 0) { setAspectRatio(Number(box[1]) / Number(box[2])); return; }
    }

    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      if (Number.isFinite(ratio) && ratio > 0) setAspectRatio(ratio);
    };
    img.src = url;
  }

  function onWidthChange(value: string) {
    setWidth(value);
    if (!aspectRatio) return;
    const w = parseFloat(value);
    if (w > 0) setHeight((w / aspectRatio).toFixed(3));
  }

  function onHeightChange(value: string) {
    setHeight(value);
    if (!aspectRatio) return;
    const h = parseFloat(value);
    if (h > 0) setWidth((h * aspectRatio).toFixed(3));
  }

  // Switching units rewrites what's typed so the physical size is unchanged.
  function changeUnit(next: Unit) {
    const factor = UNIT_IN_CM[unit] / UNIT_IN_CM[next];
    const convert = (v: string) => {
      const n = parseFloat(v);
      if (!Number.isFinite(n)) return v;
      return String(Number((n * factor).toPrecision(6)));
    };
    setWidth(convert);
    setHeight(convert);
    setUnit(next);
  }

  async function submit() {
    if (!file) { setError('Choose an image.'); return; }
    if (!garmentName.trim()) { setError('Enter the garment/product name.'); return; }
    if (!printType.trim()) { setError('Enter the print type.'); return; }
    if (!color.trim()) { setError('Enter the colour.'); return; }
    const w = parseFloat(width) * UNIT_IN_CM[unit];
    const h = parseFloat(height) * UNIT_IN_CM[unit];
    if (!(w > 0) || !(h > 0)) { setError('Enter the real print width and height.'); return; }

    setSaving(true);
    setError(null);

    const form = new FormData();
    form.append('file', file);
    form.append('type', 'designs');
    // The rasteriser needs the physical print size to produce enough pixels.
    form.append('widthCm', String(w));
    form.append('heightCm', String(h));
    const uploadRes = await fetch('/api/admin/upload', { method: 'POST', credentials: 'include', body: form });
    if (!uploadRes.ok) {
      const detail = await uploadRes.json().catch(() => null);
      setError(detail?.error ?? 'Upload failed.');
      setSaving(false);
      return;
    }
    const { path: imagePath, sourcePath } = await uploadRes.json();

    const createRes = await fetch('/api/admin/designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ garmentName: garmentName.trim(), printType: printType.trim(), color: color.trim(), imagePath, sourcePath, widthCm: w, heightCm: h }),
    });
    if (!createRes.ok) { setError("Uploaded, but couldn't save the design record."); setSaving(false); return; }
    onCreated(await createRes.json());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Add design</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Artwork</span>
              {preview ? (
                <img src={preview} alt="" className="mb-2 h-32 w-full rounded-lg border border-gray-200 object-contain bg-gray-50" />
              ) : null}
              <input
                type="file"
                accept="image/*,.eps,.ai,.ps,.pdf,application/postscript,application/pdf,application/illustrator"
                onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
                className="w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Garment / product</span>
              <input value={garmentName} onChange={e => setGarmentName(e.target.value)} placeholder="New Heights Hoodie"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Print type</span>
                <input value={printType} onChange={e => setPrintType(e.target.value)} placeholder="Back Print"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Colour</span>
                <input value={color} onChange={e => setColor(e.target.value)} placeholder="Ocean"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
              </label>
            </div>
            <div className="grid grid-cols-[1fr_1fr_88px] gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Print width</span>
                <input type="number" min="0" step={UNIT_STEP[unit]} value={width} onChange={e => onWidthChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Print height</span>
                <input type="number" min="0" step={UNIT_STEP[unit]} value={height} onChange={e => onHeightChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Units</span>
                <select value={unit} onChange={e => changeUnit(e.target.value as Unit)}
                  className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                </select>
              </label>
            </div>
            {measuring && <p className="text-xs text-gray-400">Reading artwork…</p>}
            {isVector && !measuring && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                EPS / AI / PDF artwork is converted to a 300&nbsp;DPI transparent PNG on upload so it renders in designs and nesting sheets. The original file is kept.
              </p>
            )}
            <p className="text-xs text-gray-400">Enter the actual physical size this design prints at, not the image file's pixel dimensions — this is what the nesting tool uses to fit designs onto a sheet.{aspectRatio ? ' Enter either dimension and the other will fill in from the artwork\u2019s proportions.' : ''}</p>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 py-4">
          <button onClick={submit} disabled={saving}
            className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : 'Add design'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DesignGroup { key: string; garmentName: string; printType: string; items: Design[] }

export default function DesignsPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const deletingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/admin/designs', { credentials: 'include' })
      .then(r => r.json())
      .then(setDesigns)
      .finally(() => setLoading(false));
  }, []);

  async function deleteDesign(id: string) {
    if (deletingRef.current.has(id)) return;
    deletingRef.current.add(id);
    setDesigns(prev => prev.filter(d => d.id !== id));
    await fetch(`/api/admin/designs/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
    deletingRef.current.delete(id);
  }

  // Same garment + print type (different colours) stack together, fanning
  // out on hover — sorted alphabetically so related stacks (e.g. every
  // "New Heights Hoodie" print type) land next to each other.
  const groups: DesignGroup[] = useMemo(() => {
    const map = new Map<string, Design[]>();
    for (const d of designs) {
      const key = `${d.garmentName}::${d.printType}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        garmentName: items[0].garmentName,
        printType: items[0].printType,
        items: [...items].sort((a, b) => a.color.localeCompare(b.color)),
      }))
      .sort((a, b) => a.garmentName.localeCompare(b.garmentName) || a.printType.localeCompare(b.printType));
  }, [designs]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Designs</h1>
          <p className="text-sm text-gray-400">Reusable DTF print designs — upload once, use in any nesting job.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Add design
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">No designs yet — add your first one to start building nesting sheets.</p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {groups.map(g => {
            const stacked = g.items.length > 1;

            if (!stacked) {
              const d = g.items[0];
              return (
                <div key={g.key} className="group/item relative w-44 shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-white">
                  <div className="flex h-32 items-center justify-center bg-gray-50 p-3">
                    <img src={d.imagePath} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-gray-900">{g.garmentName}</p>
                    <p className="truncate text-xs text-gray-400">{g.printType} · {d.color}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{fmtSize(d.widthCm, d.heightCm)}</p>
                  </div>
                  <button
                    onClick={() => deleteDesign(d.id)}
                    title="Delete design"
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-400 opacity-0 shadow transition-opacity hover:text-red-600 group-hover/item:opacity-100"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            }

            // Stacked groups are real flex children, not an absolute overlay —
            // the non-first cards grow from w-0 on hover, so expanding the
            // stack actually pushes later cards along/down instead of
            // floating on top of them.
            return (
              <div key={g.key} className="group/stack flex items-start gap-3">
                {g.items.map((d, i) => (
                  <div
                    key={d.id}
                    className={
                      i === 0
                        ? 'w-44 shrink-0'
                        : 'w-0 shrink-0 overflow-hidden opacity-0 transition-[width,opacity] duration-200 ease-out group-hover/stack:w-44 group-hover/stack:opacity-100'
                    }
                  >
                    <div className="group/item relative h-44">
                      {i === 0 && (
                        <>
                          <div className="pointer-events-none absolute inset-0 translate-x-2 translate-y-2 rounded-2xl border border-gray-100 bg-white transition-opacity group-hover/stack:opacity-0" />
                          <div className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rounded-2xl border border-gray-100 bg-white transition-opacity group-hover/stack:opacity-0" />
                        </>
                      )}
                      <div className="relative w-44 overflow-hidden rounded-2xl border border-gray-100 bg-white">
                        <div className="flex h-32 items-center justify-center bg-gray-50 p-3">
                          <img src={d.imagePath} alt="" className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="p-3">
                          <p className="truncate text-sm font-medium text-gray-900">{g.garmentName}</p>
                          {i === 0 ? (
                            <>
                              <p className="truncate text-xs text-gray-400 group-hover/stack:hidden">{g.printType} · {g.items.length} colours</p>
                              <p className="hidden truncate text-xs text-gray-400 group-hover/stack:block">{g.printType} · {d.color}</p>
                            </>
                          ) : (
                            <p className="truncate text-xs text-gray-400">{g.printType} · {d.color}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteDesign(d.id)}
                        title="Delete design"
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-400 opacity-0 shadow transition-opacity hover:text-red-600 group-hover/item:opacity-100"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <AddDesignModal
          onClose={() => setAdding(false)}
          onCreated={design => { setDesigns(prev => [design, ...prev]); setAdding(false); }}
        />
      )}
    </div>
  );
}
