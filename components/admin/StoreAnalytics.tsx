'use client';

import { useEffect, useState } from 'react';

interface Order {
  id: string;
  total: number | null;
  currency: string | null;
  created: number;
  customer: { name: string };
  status: string;
}

function fmt(currency: string | null, pence: number | null) {
  if (pence == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (currency ?? 'gbp').toUpperCase() }).format(pence / 100);
}

export default function StoreAnalytics() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/orders', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!cancelled) setOrders(d.orders ?? []); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const total = orders?.reduce((sum, o) => sum + (o.total ?? 0), 0) ?? 0;
  const latest = orders && orders.length > 0 ? orders[0] : null;
  const last24h = orders?.filter(o => Date.now() - o.created * 1000 < 24 * 60 * 60 * 1000).length ?? 0;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Revenue (recent)</p>
        <p className="mt-3 text-3xl font-light text-gray-900">{orders ? fmt(latest?.currency ?? 'gbp', total) : '—'}</p>
        {error && <p className="mt-2 text-xs text-red-400">Couldn&rsquo;t load orders.</p>}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Orders, last 24h</p>
        <p className="mt-3 text-3xl font-light text-gray-900">{orders ? last24h : '—'}</p>
        <p className="mt-2 text-xs text-gray-400">of {orders ? orders.length : '—'} loaded</p>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Latest order</p>
        {latest ? (
          <>
            <p className="mt-3 truncate text-lg font-medium text-gray-900">{latest.customer.name}</p>
            <p className="mt-1 text-sm text-gray-400">{fmt(latest.currency, latest.total)} · {new Date(latest.created * 1000).toLocaleDateString('en-GB')}</p>
          </>
        ) : (
          <p className="mt-3 text-3xl font-light text-gray-900">{orders ? '—' : '…'}</p>
        )}
      </div>
    </div>
  );
}