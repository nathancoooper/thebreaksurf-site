'use client';

import { useEffect, useState } from 'react';
import { Review } from '@/types';
import StarRating from '@/components/StarRating';
import productsData from '@/data/products.json';

const products = productsData as { id: string; name: string }[];

function productName(id: string) {
  return products.find(p => p.id === id)?.name ?? id;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Filter = 'pending' | 'approved' | 'rejected';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/reviews').then(r => r.json()).then(data => {
      setReviews(data);
      setLoading(false);
    });
  }, []);

  async function setStatus(id: string, status: 'approved' | 'rejected') {
    await fetch(`/api/admin/reviews/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  async function deleteReview(id: string) {
    await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    setReviews(prev => prev.filter(r => r.id !== id));
  }

  const visible = reviews.filter(r => r.status === filter);
  const counts = {
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    rejected: reviews.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="p-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Reviews</h1>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['pending', 'approved', 'rejected'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {f}
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
              f === 'pending' && counts.pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400">No {filter} reviews.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <StarRating rating={r.rating} size={14} />
                    <span className="text-xs text-gray-400">{r.rating} / 5</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {productName(r.productId)} · {formatDate(r.date)}
                  </p>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">{r.body}</p>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  {r.status !== 'approved' && (
                    <button
                      onClick={() => setStatus(r.id, 'approved')}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      onClick={() => setStatus(r.id, 'rejected')}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Reject
                    </button>
                  )}
                  <button
                    onClick={() => deleteReview(r.id)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
