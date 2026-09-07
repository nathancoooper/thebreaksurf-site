'use client';

import { useEffect, useState, useMemo } from 'react';
import ErpFreshness from '@/components/admin/ErpFreshness';

interface StockLine {
  item_code: string;
  item_name: string;
  item_group: string;
  variant_of: string | null;
  warehouse: string;
  uom: string;
  actual_qty: number;
  reserved_qty: number;
  available: number;
  valuation_rate: number;
  stock_value: number;
  item_image: string | null;
  parent_image: string | null;
}

interface Warehouse { name: string; warehouse_name: string }
interface ProductImages {
  cover: string;
  colors?: Record<string, { cover: string }>;
}
interface ProductData { name: string; images: ProductImages }

type FilterKey = 'all' | 'Products' | 'Raw Material';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'Products',     label: 'Products' },
  { key: 'Raw Material', label: 'Raw Materials' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

function qty(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

// Parse "Staple Tee-Grass-S" → { colour: "Grass", size: "S" }
function parseVariant(itemCode: string, variantOf: string): { colour: string; size: string } {
  const suffix = itemCode.slice(variantOf.length + 1); // "Grass-S"
  const parts = suffix.split('-');
  const size = parts[parts.length - 1];
  const colour = parts.slice(0, -1).join('-');
  return { colour, size };
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
function sizeSort(a: string, b: string) {
  const ai = SIZE_ORDER.indexOf(a);
  const bi = SIZE_ORDER.indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  return a.localeCompare(b);
}

export default function StockPage() {
  const [stock, setStock]           = useState<StockLine[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts]     = useState<ProductData[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterKey>('all');
  const [warehouse, setWarehouse]   = useState('');
  const [search, setSearch]         = useState('');
  const [fetchedAt, setFetchedAt]   = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stock', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/products').then(r => r.json()),
    ]).then(([stockData, productsData]) => {
      setStock(stockData.stock);
      setWarehouses(stockData.warehouses);
      setFetchedAt(stockData.fetchedAt);
      setProducts(productsData);
    }).finally(() => setLoading(false));
  }, []);

  // colour image lookup: productName → colourName → imageUrl
  // Also indexed without "TBS " prefix so ERPNext names like "Stickers" match "TBS Stickers"
  const colourImageMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const p of products) {
      const keys = [p.name];
      if (p.name.startsWith('TBS ')) keys.push(p.name.slice(4));
      for (const key of keys) {
        map[key] = {};
        if (p.images.colors) {
          for (const [colour, imgs] of Object.entries(p.images.colors)) {
            map[key][colour] = imgs.cover;
          }
        }
        map[key]['__default'] = p.images.cover;
      }
    }
    return map;
  }, [products]);

  const filtered = useMemo(() => stock.filter(s =>
    (filter === 'all' || s.item_group === filter) &&
    (!warehouse || s.warehouse === warehouse) &&
    (!search    || s.item_name.toLowerCase().includes(search.toLowerCase()) || s.item_code.toLowerCase().includes(search.toLowerCase()))
  ), [stock, filter, warehouse, search]);

  const totalValue = filtered.reduce((s, l) => s + l.stock_value, 0);
  const countFor = (key: FilterKey) => key === 'all' ? stock.length : stock.filter(s => s.item_group === key).length;

  const websiteProductNames = useMemo(() => new Set(products.map(p => p.name)), [products]);

  // Group products by variant_of → colour → sizes
  const productGroups = useMemo(() => {
    if (filter !== 'Products') return null;
    const groups: Record<string, Record<string, StockLine[]>> = {};
    for (const line of filtered) {
      if (!line.variant_of) continue;
      if (!groups[line.variant_of]) groups[line.variant_of] = {};
      // For website products, parse colour from the item code; for others use the full suffix
      const isWebsite = websiteProductNames.has(line.variant_of);
      const label = isWebsite
        ? parseVariant(line.item_code, line.variant_of).colour
        : line.item_code.slice(line.variant_of.length + 1);
      if (!groups[line.variant_of][label]) groups[line.variant_of][label] = [];
      groups[line.variant_of][label].push(line);
    }
    // Sort sizes within each colour (website products only)
    for (const [productName, colours] of Object.entries(groups)) {
      if (!websiteProductNames.has(productName)) continue;
      for (const colour of Object.keys(colours))
        colours[colour].sort((a, b) => sizeSort(parseVariant(a.item_code, a.variant_of!).size, parseVariant(b.item_code, b.variant_of!).size));
    }
    return groups;
  }, [filtered, filter, websiteProductNames]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Stock</h1>
          <ErpFreshness fetchedAt={fetchedAt} />
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-900">{fmt(totalValue)}</p>
          <p className="text-xs text-gray-400">{filtered.length} line{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filter tags */}
      <div className="mb-4 flex gap-2">
        {FILTERS.map(({ key, label }) => {
          const count = countFor(key);
          const active = filter === key;
          return (
            <button key={key} onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}>
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-400'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + warehouse filter */}
      <div className="mb-6 flex gap-3">
        <input type="text" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-300 focus:border-gray-400 focus:outline-none" />
        <select value={warehouse} onChange={e => setWarehouse(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
          <option value="">All warehouses</option>
          {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">No stock found.</p>
        </div>
      )}

      {/* Grouped product view */}
      {!loading && productGroups && Object.keys(productGroups).length > 0 && (
        <div className="space-y-4">
          {Object.entries(productGroups).map(([product, colours]) => (
            <div key={product} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="border-b border-gray-100 px-6 py-4">
                <p className="text-sm font-semibold text-gray-900">{product}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {Object.values(colours).flat().reduce((s, l) => s + l.actual_qty, 0)} units · {fmt(Object.values(colours).flat().reduce((s, l) => s + l.stock_value, 0))}
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {Object.entries(colours).map(([colour, lines]) => {
                  const erpImage = lines[0]?.parent_image ?? lines[0]?.item_image ?? null;
                  const erpImageUrl = erpImage ? `${process.env.NEXT_PUBLIC_ERPNEXT_URL ?? 'https://www.erpnext.nathanjohncooper.co.uk'}${erpImage}` : null;
                  const coverImage = colourImageMap[product]?.[colour] ?? colourImageMap[product]?.['__default'] ?? erpImageUrl;
                  const isWebsite = websiteProductNames.has(product);
                  const totalQty = lines.reduce((s, l) => s + l.actual_qty, 0);
                  return (
                    <div key={colour} className="flex items-start gap-4 px-6 py-4">
                      {coverImage && (
                        <img src={coverImage} alt={colour}
                          className="h-16 w-16 shrink-0 rounded-lg object-cover bg-gray-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="mb-2.5 text-xs font-medium text-gray-500">{colour}</p>
                        {isWebsite ? (
                          <div className="flex flex-wrap gap-2">
                            {lines.map(line => {
                              const { size } = parseVariant(line.item_code, product);
                              return (
                                <div key={line.item_code}
                                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${line.available <= 0 ? 'border-red-100 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                                  <span className="text-xs font-semibold text-gray-700">{size}</span>
                                  <span className={`text-sm font-semibold ${line.available <= 0 ? 'text-red-500' : 'text-gray-900'}`}>{qty(line.actual_qty)}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className={`text-sm font-semibold ${totalQty <= 0 ? 'text-red-500' : 'text-gray-900'}`}>{totalQty} units</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Flat table for non-product views */}
      {!loading && !productGroups && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="grid grid-cols-[1fr_160px_80px_80px_80px_110px] gap-4 border-b border-gray-100 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <span>Item</span>
            <span>Warehouse</span>
            <span className="text-right">On hand</span>
            <span className="text-right">Reserved</span>
            <span className="text-right">Available</span>
            <span className="text-right">Value</span>
          </div>
          {filtered.map((line, i) => (
            <div key={`${line.item_code}-${line.warehouse}`}
              className={`grid grid-cols-[1fr_160px_80px_80px_80px_110px] gap-4 px-6 py-3.5 ${i < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{line.item_name}</p>
                <p className="mt-0.5 font-mono text-xs text-gray-400">{line.item_code} · {line.item_group}</p>
              </div>
              <div className="self-center">
                <p className="truncate text-sm text-gray-600">{line.warehouse.replace(' - TBS', '')}</p>
              </div>
              <div className="self-center text-right">
                <p className="text-sm text-gray-900">{qty(line.actual_qty)}</p>
              </div>
              <div className="self-center text-right">
                <p className={`text-sm ${line.reserved_qty > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                  {line.reserved_qty > 0 ? qty(line.reserved_qty) : '—'}
                </p>
              </div>
              <div className="self-center text-right">
                <p className={`text-sm font-medium ${line.available <= 0 ? 'text-red-500' : 'text-gray-900'}`}>{qty(line.available)}</p>
              </div>
              <div className="self-center text-right">
                <p className="text-sm text-gray-700">{fmt(line.stock_value)}</p>
                <p className="text-xs text-gray-400">{fmt(line.valuation_rate)} ea</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
