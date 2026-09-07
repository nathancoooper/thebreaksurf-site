'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/types';

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);

  async function load() {
    const res = await fetch('/api/admin/products');
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <button
          onClick={() => router.push('/admin/products/new')}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Add product
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && products.length === 0 && <p className="text-sm text-gray-500">No products yet.</p>}

      {!loading && products.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          {products.map((p, i) => (
            <div key={p.id} className={i < products.length - 1 ? 'border-b border-gray-50' : ''}>
              <div className="flex items-center gap-4 px-6 py-4">
                {p.images.cover && (
                  <img src={p.images.cover} alt={p.name}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover bg-gray-100"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{p.colors.join(', ')} · £{(p.price / 100).toFixed(2)}</p>
                </div>

                <button onClick={() => router.push(`/admin/products/${p.id}`)}
                  className="text-sm text-[#C4622D] hover:underline">Edit</button>
                <button onClick={() => handleDelete(p.id, p.name)}
                  className="text-sm text-gray-400 hover:text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
