'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Promotion } from '@/types';

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function status(promo: Promotion): { label: string; className: string } {
  const now = new Date();
  const start = new Date(`${promo.startDate}T00:00:00`);
  const end = new Date(`${promo.endDate}T23:59:59`);
  if (now < start) return { label: 'Upcoming', className: 'bg-amber-50 text-amber-700' };
  if (now > end) return { label: 'Ended', className: 'bg-gray-100 text-gray-500' };
  return { label: 'Active', className: 'bg-green-50 text-green-700' };
}

export default function AdminPromotionsPage() {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/admin/promotions');
    if (res.ok) setPromotions(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' });
    load();
  }

  const sorted = [...promotions].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Promotions</h1>
        <button
          onClick={() => router.push('/admin/promotions/new')}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Add promotion
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No promotions yet.</p>
          <button
            onClick={() => router.push('/admin/promotions/new')}
            className="mt-3 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Create your first one →
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">Promotion</th>
                <th className="px-5 py-3">Discount</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3">Runs</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(promo => {
                const s = status(promo);
                return (
                  <tr key={promo.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{promo.label}</td>
                    <td className="px-5 py-3.5 text-gray-500">-{promo.discountPercent}%</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {promo.scope === 'all' ? 'All products' : `${promo.productIds?.length ?? 0} product${(promo.productIds?.length ?? 0) === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {formatDate(promo.startDate)} – {formatDate(promo.endDate)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => router.push(`/admin/promotions/${promo.id}`)}
                        className="mr-4 text-[#C4622D] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(promo.id, promo.label)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
