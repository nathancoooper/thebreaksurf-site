'use client';

import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import type { TagData } from '@/lib/serials';

interface SummaryRow {
  itemCode: string;
  active: number;
  unprinted: number;
}

// Physical tag size — tweak here when the label stock is chosen.
const TAG_W = '50mm';
const TAG_H = '80mm';

function fmtPrice(pence: number | null) {
  if (pence == null) return null;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

/** Pick readable text colour for a background hex. */
function textColour(bg: string): string {
  const m = bg.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65 ? '#111111' : '#ffffff';
}

export default function TagPrinterPage() {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [tags, setTags] = useState<TagData[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [printQueue, setPrintQueue] = useState<TagData[] | null>(null);

  async function loadSummary() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tags');
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data = await res.json();
      setSummary(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSummary(); }, []);

  async function openItem(itemCode: string) {
    setSelectedItem(itemCode);
    setTags([]);
    setChecked(new Set());
    const res = await fetch(`/api/admin/tags?item=${encodeURIComponent(itemCode)}`);
    if (!res.ok) { setError(`Failed to load serials: ${res.status}`); return; }
    const data = await res.json();
    setTags(data.tags);
    setChecked(new Set(data.tags.map((t: TagData) => t.serial)));
  }

  const allChecked = tags.length > 0 && checked.size === tags.length;

  const toggle = useCallback((serial: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(serial)) next.delete(serial); else next.add(serial);
      return next;
    });
  }, []);

  async function printSelected() {
    const queue = tags.filter(t => checked.has(t.serial));
    if (queue.length === 0) return;
    // Generate all QR codes up front — the print dialog must never open on
    // half-rendered tags.
    const entries = await Promise.all(queue.map(async t => [
      t.serial,
      await QRCode.toDataURL(t.qrUrl, { margin: 0, width: 300, errorCorrectionLevel: 'M' }),
    ] as const));
    setQrUrls(Object.fromEntries(entries));
    setPrintQueue(queue);
    // Let React paint the sheet before the dialog blocks the main thread.
    await new Promise(r => setTimeout(r, 100));
    window.print();
    const ok = confirm(`Mark ${queue.length} tag${queue.length === 1 ? '' : 's'} as printed?\n\nCancel only if the print didn't happen.`);
    setPrintQueue(null);
    if (ok) {
      const res = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serials: queue.map(t => t.serial) }),
      });
      if (!res.ok) { setError('Printing happened but marking as printed failed — reprints may duplicate.'); return; }
      setSelectedItem(null);
      loadSummary();
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Tag Printer</h1>
        <p className="mt-1 text-sm text-gray-500">
          Print swing tags for serialised stock. Every active serial without a printed tag is listed —
          serials come from ERPNext purchase receipts.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!selectedItem && (
        loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : summary.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-400">No untagged serialised stock. Everything printed ✓</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">In stock</th>
                  <th className="px-5 py-3">Untagged</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.map(row => (
                  <tr key={row.itemCode} className={`hover:bg-gray-50 ${row.unprinted === 0 ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{row.itemCode}</td>
                    <td className="px-5 py-3.5 text-gray-500">{row.active}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${row.unprinted > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                        {row.unprinted}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {row.unprinted > 0 && (
                        <button onClick={() => openItem(row.itemCode)} className="text-[#C4622D] hover:underline">
                          Print tags
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {selectedItem && (
        <div className="no-print">
          <button onClick={() => setSelectedItem(null)} className="mb-4 text-sm text-gray-500 hover:text-gray-900">
            ← All items
          </button>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{selectedItem}</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => setChecked(allChecked ? new Set() : new Set(tags.map(t => t.serial)))}
                />
                Select all
              </label>
              <button
                onClick={printSelected}
                disabled={checked.size === 0 || printQueue !== null}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
              >
                Print {checked.size} tag{checked.size === 1 ? '' : 's'}
              </button>
            </div>
          </div>

          {tags.length === 0 ? (
            <p className="text-sm text-gray-500">Loading serials…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {tags.map(t => {
                const bg = t.colorHex ?? '#e5e7eb';
                const price = fmtPrice(t.price);
                return (
                  <label
                    key={t.serial}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
                    style={{ background: checked.has(t.serial) ? '#f9fafb' : '#fff', borderColor: checked.has(t.serial) ? '#111827' : '#e5e7eb' }}
                  >
                    <input type="checkbox" checked={checked.has(t.serial)} onChange={() => toggle(t.serial)} />
                    <div className="h-8 w-8 shrink-0 rounded-full border border-black/10" style={{ background: bg }} title={t.colour ?? undefined} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-gray-900">{t.size ?? '?'} · {t.colour ?? '?'}</p>
                      <p className="truncate text-xs text-gray-500">{price ?? '—'}</p>
                      <p className="truncate font-mono text-[10px] text-gray-400">{t.serial}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Print sheet — only this subtree is visible on paper. */}
      {printQueue && (
        <div className="print-sheet" style={{ display: 'none' }}>
          <style>{`
            @media print {
              * { visibility: hidden !important; }
              .print-sheet, .print-sheet * { visibility: visible !important; }
              .print-sheet {
                display: flex !important;
                position: absolute !important;
                left: 0; top: 0; width: 100%;
                flex-wrap: wrap;
                align-content: flex-start;
                gap: 6mm;
              }
              @page { margin: 8mm; }
            }
          `}</style>
          {printQueue.map(t => {
            const bg = t.colorHex ?? '#e5e7eb';
            const fg = textColour(bg);
            const price = fmtPrice(t.price);
            return (
              <div
                key={t.serial}
                style={{
                  width: TAG_W,
                  height: TAG_H,
                  background: bg,
                  color: fg,
                  breakInside: 'avoid',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6mm 4mm',
                  borderRadius: '4mm',
                  boxSizing: 'border-box',
                }}
              >
                {t.productName && (
                  <div style={{ fontSize: '3mm', fontWeight: 600, letterSpacing: '0.02em', textAlign: 'center', width: '100%' }}>
                    {t.productName}
                  </div>
                )}
                {/* White plate so the QR scans regardless of the tag colour */}
                <div style={{ background: '#ffffff', padding: '1.5mm', borderRadius: '1.5mm', lineHeight: 0 }}>
                  {qrUrls[t.serial]
                    ? // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrUrls[t.serial]} alt="" style={{ width: '26mm', height: '26mm' }} />
                    : <div style={{ width: '26mm', height: '26mm' }} />}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '2.2mm', opacity: 0.75, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.serial}
                </div>
                <div style={{ fontSize: '11mm', fontWeight: 800, lineHeight: 1 }}>
                  {t.size ?? '?'}
                </div>
                <div style={{ fontSize: '5mm', fontWeight: 600 }}>
                  {price ?? ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
