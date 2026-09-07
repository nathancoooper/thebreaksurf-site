'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/types';

export default function NewPromotionPage() {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [discountPercent, setDiscountPercent] = useState('20');
  const [scope, setScope] = useState<'all' | 'products'>('all');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/products').then(r => r.json()).then(setProducts).catch(() => {});
  }, []);

  function toggleProduct(id: string) {
    setProductIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, discountPercent: Number(discountPercent), scope, productIds, startDate, endDate }),
    });
    if (res.ok) {
      router.push('/admin/promotions');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setSaving(false);
    }
  }

  const canSave = label && discountPercent && startDate && endDate && (scope === 'all' || productIds.length > 0);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">New promotion</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/promotions')} className="text-sm text-gray-500 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="rounded-md bg-[#C4622D] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save promotion'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="mx-auto max-w-xl">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Label</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Summer Sale"
                className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
              />
              <p className="mt-1 text-[11px] text-gray-400">Internal name only — never shown to customers.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Discount</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={discountPercent}
                  onChange={e => setDiscountPercent(e.target.value)}
                  className="block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
                <span className="text-sm text-gray-500">% off</span>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">Starts</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">Ends</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-gray-400">
              Discount and sale badge show automatically while the run is live — no code needed at checkout.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700">Applies to</label>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    scope === 'all' ? 'border-[#C4622D] bg-[#C4622D]/10 text-[#C4622D]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Whole store
                </button>
                <button
                  type="button"
                  onClick={() => setScope('products')}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    scope === 'products' ? 'border-[#C4622D] bg-[#C4622D]/10 text-[#C4622D]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Specific products
                </button>
              </div>
            </div>

            {scope === 'products' && (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
                {products.length === 0 && <p className="p-2 text-xs text-gray-400">No products found.</p>}
                {products.map(p => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={productIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="h-4 w-4 rounded border-gray-300 text-[#C4622D] focus:ring-[#C4622D]"
                    />
                    <img
                      src={p.images.cover}
                      alt=""
                      className="h-8 w-8 rounded object-cover bg-gray-100"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="text-gray-800">{p.name}</span>
                    <span className="ml-auto text-xs text-gray-400">£{(p.price / 100).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
