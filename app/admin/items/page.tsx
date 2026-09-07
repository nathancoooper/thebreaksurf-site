'use client';

import { useEffect, useState, useCallback } from 'react';

type Group = 'Raw Material' | 'Products';

interface Variant {
  name: string;
  item_code: string;
  item_name: string;
  stock_uom: string;
  colour: string;
  size: string;
}

interface ItemGroupRow {
  key: string;
  item_name: string;
  stock_uom: string;
  default_bom: string | null;
  image: string | null;
  variants: Variant[];
}

const TABS: { key: Group; label: string; blurb: string }[] = [
  { key: 'Raw Material', label: 'Raw Materials', blurb: 'Orderable via Purchase Orders' },
  { key: 'Products',     label: 'Products',      blurb: 'Manufacturable via Work Orders' },
];

const ERP_URL = process.env.NEXT_PUBLIC_ERPNEXT_URL ?? 'https://www.erpnext.nathanjohncooper.co.uk';

function Thumb({ image }: { image: string | null }) {
  if (image) {
    return <img src={image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" />
      </svg>
    </div>
  );
}

function BomBadge({ item }: { item: { key: string; default_bom: string | null } }) {
  return item.default_bom ? (
    <span className="text-xs text-green-700">Has BOM</span>
  ) : (
    <a
      href={`${ERP_URL}/app/bom/new?item=${encodeURIComponent(item.key)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700"
    >
      No BOM — add in ERPNext
    </a>
  );
}

interface Options { brands: string[]; attributes: string[]; itemGroups: string[] }

export default function ItemsPage() {
  const [tab, setTab]         = useState<Group>('Raw Material');
  const [items, setItems]     = useState<ItemGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [itemCode, setItemCode]   = useState('');
  const [itemName, setItemName]   = useState('');
  const [itemGroup, setItemGroup] = useState<string>('Raw Material');
  const [stockUom, setStockUom]   = useState('Nos');
  const [maintainStock, setMaintainStock] = useState(true);
  const [allowSales, setAllowSales]       = useState(true);
  const [allowPurchases, setAllowPurchases] = useState(true);
  const [hasVariants, setHasVariants]     = useState(false);
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);
  const [brand, setBrand]         = useState('');
  const [options, setOptions]     = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/items?group=${encodeURIComponent(tab)}`, { credentials: 'include' });
    if (r.ok) { const data = await r.json(); setItems(data.items); }
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); setExpanded(new Set()); }, [load]);

  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function fetchOptions() {
    if (options) return;
    const r = await fetch('/api/admin/items/options', { credentials: 'include' });
    if (r.ok) setOptions(await r.json());
  }

  function openPanel() {
    setPanelOpen(true);
    setError(null);
    setItemCode('');
    setItemName('');
    setItemGroup(tab);
    setStockUom('Nos');
    setMaintainStock(true);
    setAllowSales(true);
    setAllowPurchases(true);
    setHasVariants(false);
    setSelectedAttrs([]);
    setBrand('');
    fetchOptions();
  }

  function toggleAttr(attr: string) {
    setSelectedAttrs(prev => prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]);
  }

  async function createItem() {
    if (!itemCode.trim() || !itemName.trim()) return;
    if (hasVariants && selectedAttrs.length === 0) { setError('Pick at least one attribute for a variant template.'); return; }
    setCreating(true);
    setError(null);
    const r = await fetch('/api/admin/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        item_code: itemCode.trim(),
        item_name: itemName.trim(),
        item_group: itemGroup,
        stock_uom: stockUom.trim() || 'Nos',
        maintain_stock: maintainStock,
        allow_sales: allowSales,
        allow_purchases: allowPurchases,
        has_variants: hasVariants,
        attributes: hasVariants ? selectedAttrs : undefined,
        brand: brand || undefined,
      }),
    });
    if (r.ok) {
      setPanelOpen(false);
      // Switch to whichever tab the new item actually belongs to so it's
      // visible immediately — otherwise it silently vanishes if created
      // under a different group than the one you were viewing.
      if ((itemGroup === 'Raw Material' || itemGroup === 'Products') && itemGroup !== tab) {
        setTab(itemGroup);
      } else {
        await load();
      }
    } else {
      const data = await r.json().catch(() => ({}));
      setError(data.error ?? 'ERPNext rejected this item — check the item code isn\'t already in use.');
    }
    setCreating(false);
  }

  const activeTab = TABS.find(t => t.key === tab)!;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Items</h1>
          <p className="mt-0.5 text-sm text-gray-400">Live from ERPNext</p>
        </div>
        <button
          onClick={openPanel}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + New item
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-gray-400">{activeTab.blurb}</p>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">No {activeTab.label.toLowerCase()} found in ERPNext.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className={`grid ${tab === 'Products' ? 'grid-cols-[40px_1fr_140px_100px_180px_20px]' : 'grid-cols-[40px_1fr_140px_100px_20px]'} gap-4 border-b border-gray-100 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400`}>
            <span />
            <span>Item</span>
            <span>Code</span>
            <span>UOM</span>
            {tab === 'Products' && <span>BOM</span>}
            <span />
          </div>

          {items.map((item, i) => {
            const hasVariants = item.variants.length > 0;
            const isOpen = expanded.has(item.key);
            return (
              <div key={item.key} className={i < items.length - 1 ? 'border-b border-gray-50' : ''}>
                <button
                  onClick={() => hasVariants && toggleExpanded(item.key)}
                  className={`grid w-full ${tab === 'Products' ? 'grid-cols-[40px_1fr_140px_100px_180px_20px]' : 'grid-cols-[40px_1fr_140px_100px_20px]'} items-center gap-4 px-6 py-3 text-left transition-colors ${hasVariants ? 'hover:bg-gray-50' : ''}`}
                >
                  <Thumb image={item.image} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{item.item_name}</p>
                    {hasVariants && <p className="text-xs text-gray-400">{item.variants.length} variant{item.variants.length !== 1 ? 's' : ''}</p>}
                  </div>
                  <p className="truncate text-sm text-gray-500">{item.key}</p>
                  <p className="text-sm text-gray-500">{item.stock_uom}</p>
                  {tab === 'Products' && <BomBadge item={item} />}
                  {hasVariants && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      className={`text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  )}
                </button>

                {isOpen && hasVariants && (
                  <div className="border-t border-gray-50 bg-gray-50/60 px-6 py-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] text-gray-400">
                          <th className="py-1.5 pl-12 text-left font-medium">Product</th>
                          <th className="py-1.5 text-left font-medium">Colour</th>
                          <th className="py-1.5 text-left font-medium">Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {item.variants.map((v, j) => {
                          const newColourGroup = j === 0 || item.variants[j - 1].colour !== v.colour;
                          return (
                            <tr key={v.name} className={newColourGroup && j > 0 ? 'border-t border-gray-200' : ''}>
                              <td className="py-2 pl-12 text-gray-700">{item.item_name}</td>
                              <td className="py-2 text-gray-900">{newColourGroup ? v.colour : ''}</td>
                              <td className="py-2 text-gray-500">{v.size}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setPanelOpen(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">New item</h2>
              <button onClick={() => setPanelOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-5">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Item code</span>
                <input value={itemCode} onChange={e => setItemCode(e.target.value)} placeholder="e.g. OGT-RED-M"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Item name</span>
                <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. FoTL Original Tee-RED-M"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Item group</span>
                <select value={itemGroup} onChange={e => setItemGroup(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                  {(options?.itemGroups ?? ['Raw Material', 'Products']).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Stock unit</span>
                <input value={stockUom} onChange={e => setStockUom(e.target.value)} placeholder="Nos"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Brand</span>
                <select value={brand} onChange={e => setBrand(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                  <option value="">None</option>
                  {options?.brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={maintainStock} onChange={e => setMaintainStock(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400" />
                <span className="text-sm text-gray-700">Maintain stock</span>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allowSales} onChange={e => setAllowSales(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400" />
                <span className="text-sm text-gray-700">Allow sales</span>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allowPurchases} onChange={e => setAllowPurchases(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400" />
                <span className="text-sm text-gray-700">Allow purchases</span>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hasVariants} onChange={e => { setHasVariants(e.target.checked); setSelectedAttrs([]); }}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400" />
                <span className="text-sm text-gray-700">Has variants</span>
              </label>

              {hasVariants && (
                <div>
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Variant attributes</span>
                  <div className="flex flex-wrap gap-2">
                    {options?.attributes.map(a => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAttr(a)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedAttrs.includes(a) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    This creates the template only (e.g. "New Heights Hoodie") — add each colour/size variant as its own item afterwards.
                  </p>
                </div>
              )}

              {!hasVariants && (
                <p className="text-xs text-gray-400">
                  {itemGroup === 'Products'
                    ? 'This creates a standalone item — add its Bill of Materials in ERPNext once it exists here.'
                    : 'This creates a single item code (e.g. one colour/size).'}
                </p>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <div className="border-t border-gray-100 px-6 py-4">
              <button
                onClick={createItem}
                disabled={creating || !itemCode.trim() || !itemName.trim()}
                className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {creating ? 'Creating…' : 'Create item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
