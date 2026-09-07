'use client';

import { useEffect, useState } from 'react';

interface Variant { item_code: string; item_name: string; bom: string | null }
interface Product { name: string; variants: Variant[] }
interface VariantStockRow { colour: string; size: string; qty: number; unitPrice: number }
interface ProductStockGroup { name: string; totalQty: number; totalValue: number; variants: VariantStockRow[] }
interface Stats { totalUnits: number; totalCost: number; totalValue: number; productBreakdown: ProductStockGroup[] }

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

function BentoBox({ label, value, loading, currency }: { label: string; value: number | null; loading: boolean; currency?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">
        {loading || value === null ? '—' : currency ? fmt(value) : `${value.toLocaleString()} units`}
      </p>
    </div>
  );
}

function CreateWorkOrdersModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [openProduct, setOpenProduct] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [plannedDate, setPlannedDate] = useState(todayIso());
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<{ item_code: string; wo?: string; error?: string }[] | null>(null);
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/boms/options', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setProducts(data.products));
  }, []);

  // Re-checked whenever the planned date changes — how many of each variant
  // *could* have been built depends on raw-material stock as of that date,
  // not today's stock, so this can't just be computed once on load.
  useEffect(() => {
    const buildable = products.flatMap(p => p.variants).filter(v => v.bom);
    if (buildable.length === 0) return;
    setAvailabilityLoading(true);
    fetch('/api/admin/boms/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        items: buildable.map(v => ({ item_code: v.item_code, bom_no: v.bom })),
        date: plannedDate,
      }),
    })
      .then(r => r.json())
      .then(data => setAvailability(data.availability ?? {}))
      .finally(() => setAvailabilityLoading(false));
  }, [products, plannedDate]);

  // ERPNext only ever lets you create one Work Order at a time — this modal
  // lets quantities be set across every product/variant first, then sends
  // the whole batch to the API in a single request, which loops and creates
  // however many WOs are actually needed.
  const selectedCount = products
    .flatMap(p => p.variants)
    .filter(v => parseFloat(quantities[v.item_code] ?? '0') > 0).length;

  async function submit() {
    const items = products
      .flatMap(p => p.variants)
      .filter(v => v.bom && parseFloat(quantities[v.item_code] ?? '0') > 0)
      .map(v => ({ item_code: v.item_code, bom_no: v.bom as string, qty: parseFloat(quantities[v.item_code]) }));
    if (items.length === 0) return;
    setCreating(true);
    setResults(null);
    const r = await fetch('/api/admin/work-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ items, planned_date: plannedDate }),
    });
    const data = await r.json();
    setResults(data.results);
    setCreating(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-6">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Create Work Orders</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-auto p-3">
          {products.map(p => {
            const buildable = p.variants.filter(v => v.bom);
            if (buildable.length === 0) return null;
            const isOpen = openProduct === p.name;
            const selectedInProduct = buildable.filter(v => parseFloat(quantities[v.item_code] ?? '0') > 0).length;
            return (
              <div key={p.name} className="rounded-lg border border-gray-100">
                <button
                  onClick={() => setOpenProduct(isOpen ? null : p.name)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-gray-400">{selectedInProduct > 0 ? `${selectedInProduct} selected` : `${buildable.length} variants`}</span>
                </button>
                {isOpen && (
                  <div className="space-y-1 border-t border-gray-100 p-3">
                    {buildable.map(v => {
                      const canMake = availability[v.item_code];
                      return (
                        <div key={v.item_code} className="flex items-center gap-3 rounded-lg px-3 py-2">
                          <span className="flex-1 text-sm text-gray-700">{v.item_name}</span>
                          <span className="text-xs text-gray-400">
                            {availabilityLoading ? '…' : canMake !== undefined ? `${canMake} can be made` : ''}
                          </span>
                          <input
                            type="number" min="0" step="1" value={quantities[v.item_code] ?? ''}
                            onChange={e => setQuantities(prev => ({ ...prev, [v.item_code]: e.target.value }))}
                            placeholder="Qty"
                            className="w-20 rounded-md border border-gray-200 px-2 py-1 text-right text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-3 border-t border-gray-100 px-6 py-4">
          {results && (
            <div className="max-h-32 space-y-1 overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
              {results.map(r => (
                <p key={r.item_code} className={r.error ? 'text-red-600' : 'text-green-700'}>
                  {r.item_code}: {r.error ?? `${r.wo} created`}
                </p>
              ))}
            </div>
          )}
          <div className="flex items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Date</span>
              <input
                type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
              />
            </label>
            <button
              onClick={submit}
              disabled={creating || selectedCount === 0}
              className="flex-1 rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {creating ? 'Creating…' : `Create ${selectedCount > 0 ? `${selectedCount} Work Order${selectedCount !== 1 ? 's' : ''}` : 'Work Orders'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManufacturingOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function loadStats() {
    setStatsLoading(true);
    fetch('/api/admin/manufacturing/stats', { credentials: 'include' })
      .then(r => r.json())
      .then(setStats)
      .finally(() => setStatsLoading(false));
  }
  useEffect(() => { loadStats(); }, []);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Manufacturing Overview</h1>
          <p className="text-sm text-gray-400">Finished-goods inventory and Work Orders.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Create Work Orders
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <BentoBox label="Total Products Inventory" value={stats?.totalUnits ?? null} loading={statsLoading} />
        <BentoBox label="Total Cost of Products Inventory" value={stats?.totalCost ?? null} loading={statsLoading} currency />
        <BentoBox label="Total Value of Products Inventory" value={stats?.totalValue ?? null} loading={statsLoading} currency />
      </div>

      {statsLoading && <p className="text-sm text-gray-400">Loading…</p>}

      {!statsLoading && stats && stats.productBreakdown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">No finished-goods stock right now.</p>
        </div>
      )}

      {!statsLoading && stats && stats.productBreakdown.length > 0 && (
        <div className="space-y-4">
          {stats.productBreakdown.map(p => (
            <div key={p.name} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
                <h3 className="text-sm font-semibold text-gray-900">{p.name} ({p.totalQty})</h3>
                <span className="text-xs text-gray-400">{fmt(p.totalValue)}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {p.variants.map((v, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-2.5 text-sm">
                    <span className="text-gray-700">{[v.colour, v.size].filter(Boolean).join(' - ')}</span>
                    <span className="flex items-center gap-6 text-gray-500">
                      <span>{v.qty}x</span>
                      <span className="w-16 text-right">{fmt(v.unitPrice)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateWorkOrdersModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => loadStats()}
        />
      )}
    </div>
  );
}
