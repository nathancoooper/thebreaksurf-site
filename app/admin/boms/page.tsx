'use client';

import { useEffect, useState } from 'react';
import BomEditor, { type BomSuggestion } from '@/components/admin/BomEditor';
import { variantFamily, variantSize, withVariantSize } from '@/lib/variantNaming';

interface Variant { item_code: string; item_name: string; bom: string | null }
interface Product { name: string; standalone: boolean; variants: Variant[] }
interface RawMaterial { name: string; item_code: string; item_name: string; brand: string | null }
interface BomVersion { name: string; creation: string; docstatus: number; items: { item_code: string; qty: number }[] }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Same product, same everything except size, and that sibling already has a
// BOM — offer to copy it across with each raw material's size swapped to
// match, rather than starting from a blank form every time.
async function findBomSuggestion(variant: Variant, product: Product, rawMaterials: RawMaterial[]): Promise<BomSuggestion | null> {
  const targetFamily = variantFamily(variant.item_code);
  const targetSize = variantSize(variant.item_code);
  const sibling = product.variants.find(v => v.bom && v.item_code !== variant.item_code && variantFamily(v.item_code) === targetFamily);
  if (!sibling) return null;

  const r = await fetch(`/api/admin/boms/${encodeURIComponent(sibling.item_code)}`, { credentials: 'include' });
  const data = await r.json();
  const siblingLines: { item_code: string; qty: number }[] = data.bom?.items ?? [];
  if (siblingLines.length === 0) return null;

  const siblingSize = variantSize(sibling.item_code);
  const rawCodes = new Set(rawMaterials.map(m => m.item_code));
  const lines = siblingLines.map(l => {
    const guess = l.item_code.endsWith(`-${siblingSize}`) ? withVariantSize(l.item_code, targetSize) : l.item_code;
    return { item_code: guess, qty: l.qty, matched: rawCodes.has(guess) };
  });

  return { lines, sourceLabel: sibling.item_name };
}

export default function BomsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [variantBoms, setVariantBoms] = useState<Record<string, { item_code: string; qty: number }[]>>({});
  const [variantHistory, setVariantHistory] = useState<Record<string, BomVersion[]>>({});
  const [suggestions, setSuggestions] = useState<Record<string, BomSuggestion | null>>({});
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/admin/boms/options', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setProducts(data.products); setRawMaterials(data.rawMaterials); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  // Keep the open modal's data in sync after a save, rather than only
  // updating the background card grid.
  useEffect(() => {
    if (!openProduct) return;
    const fresh = products.find(p => p.name === openProduct.name);
    if (fresh) setOpenProduct(fresh);
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openVariantEditor(variant: Variant) {
    if (editingVariant === variant.item_code) { setEditingVariant(null); setHistoryOpenFor(null); return; }
    setEditingVariant(variant.item_code);
    setHistoryOpenFor(null);
    // Fetched regardless of whether this variant currently has a BOM — even
    // a "Missing BOM" variant can have older cancelled revisions worth
    // restoring instead of rebuilding from scratch.
    if (!variantHistory[variant.item_code]) {
      const r = await fetch(`/api/admin/boms/${encodeURIComponent(variant.item_code)}`, { credentials: 'include' });
      const data = await r.json();
      setVariantBoms(prev => ({ ...prev, [variant.item_code]: data.bom?.items ?? [] }));
      setVariantHistory(prev => ({ ...prev, [variant.item_code]: data.history ?? [] }));
    }
    if (!variant.bom && openProduct && !(variant.item_code in suggestions)) {
      const suggestion = await findBomSuggestion(variant, openProduct, rawMaterials);
      setSuggestions(prev => ({ ...prev, [variant.item_code]: suggestion }));
    }
  }

  // Restoring an old revision can't just flip a flag — BOM is submit-once,
  // so this re-runs the normal save flow with that revision's lines,
  // cancelling whatever's active now and minting a fresh version with the
  // old content, which is what actually becomes the new default.
  async function restoreVersion(itemCode: string, version: BomVersion) {
    setRestoring(version.name);
    const r = await fetch('/api/admin/boms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ item_code: itemCode, items: version.items }),
    });
    setRestoring(null);
    if (r.ok) {
      setVariantBoms(prev => { const next = { ...prev }; delete next[itemCode]; return next; });
      setVariantHistory(prev => { const next = { ...prev }; delete next[itemCode]; return next; });
      setHistoryOpenFor(null);
      load();
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Bills of Materials</h1>
        <p className="text-sm text-gray-400">What each product variant is actually made from.</p>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && products.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">No manufacturable products found.</p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {products.map(p => {
            const withBom = p.variants.filter(v => v.bom).length;
            return (
              <button
                key={p.name}
                onClick={() => setOpenProduct(p)}
                className="rounded-2xl border border-gray-100 bg-white p-5 text-left hover:border-gray-300 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {p.standalone
                    ? (withBom ? 'Standalone product · BOM set' : 'Standalone product · Missing BOM')
                    : `${p.variants.length} variant${p.variants.length !== 1 ? 's' : ''} · ${withBom}/${p.variants.length} with a BOM`}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {openProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">{openProduct.name}</h2>
              <button onClick={() => { setOpenProduct(null); setEditingVariant(null); }} className="text-gray-400 hover:text-gray-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-auto p-4">
              {openProduct.variants.map(v => (
                <div key={v.item_code} className="rounded-lg border border-gray-100">
                  <button onClick={() => openVariantEditor(v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50">
                    <span className="text-sm text-gray-700">{v.item_name}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-wide ${v.bom ? 'text-green-600' : 'text-orange-500'}`}>
                      {v.bom ? 'BOM set' : 'Missing BOM'}
                    </span>
                  </button>
                  {editingVariant === v.item_code && (() => {
                    const history = variantHistory[v.item_code];
                    const loaded = !!history;
                    const current = history?.find(h => h.docstatus === 1);
                    const past = history?.filter(h => h.name !== current?.name) ?? [];
                    return (
                      <div className="border-t border-gray-100 p-3">
                        {loaded && current && (
                          <div className="mb-3 flex items-center justify-between text-xs">
                            <span className="text-gray-500">
                              <span className="font-medium text-gray-700">{current.name}</span> · {formatDate(current.creation)}
                            </span>
                            {past.length > 0 && (
                              <button
                                onClick={() => setHistoryOpenFor(historyOpenFor === v.item_code ? null : v.item_code)}
                                className="font-medium text-gray-500 underline underline-offset-2 hover:text-gray-800"
                              >
                                {historyOpenFor === v.item_code ? 'Hide' : 'Show'} history ({past.length})
                              </button>
                            )}
                          </div>
                        )}
                        {loaded && historyOpenFor === v.item_code && (
                          <div className="mb-3 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                            {past.map(h => (
                              <div key={h.name} className="rounded-md bg-white px-2.5 py-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span>
                                    <span className="text-gray-700">{h.name}</span>
                                    <span className="ml-2 text-gray-400">{formatDate(h.creation)}</span>
                                  </span>
                                  <button
                                    onClick={() => restoreVersion(v.item_code, h)}
                                    disabled={restoring === h.name}
                                    className="font-medium text-gray-500 underline underline-offset-2 hover:text-gray-800 disabled:opacity-40"
                                  >
                                    {restoring === h.name ? 'Restoring…' : 'Restore'}
                                  </button>
                                </div>
                                <ul className="mt-1.5 space-y-0.5">
                                  {h.items.map((line, i) => {
                                    const material = rawMaterials.find(m => m.name === line.item_code);
                                    return (
                                      <li key={i} className="flex items-center justify-between text-gray-500">
                                        <span>{material?.item_name ?? line.item_code}</span>
                                        <span className="text-gray-400">×{line.qty}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                        <BomEditor
                          key={loaded ? `${v.item_code}-loaded` : `${v.item_code}-loading`}
                          itemCode={v.item_code}
                          initialLines={variantBoms[v.item_code] ?? []}
                          rawMaterials={rawMaterials}
                          suggestion={suggestions[v.item_code]}
                          onSaved={() => { setEditingVariant(null); setHistoryOpenFor(null); load(); }}
                          onCancel={() => setEditingVariant(null)}
                        />
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
