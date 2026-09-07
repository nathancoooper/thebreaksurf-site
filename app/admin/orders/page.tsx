'use client';

import { useEffect, useState } from 'react';

type OrderStatus = 'placed' | 'sent' | 'delivered';

interface OrderItem {
  description: string;
  variant?: string;
  image?: string;
  quantity: number | null;
  total: number;
  currency: string;
}

interface Order {
  id: string;
  created: number;
  paymentStatus: string;
  status: OrderStatus;
  customer: { name: string; email: string };
  shipping: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
  items: OrderItem[];
  subtotal: number | null;
  total: number | null;
  currency: string | null;
  trackingNumber: string | null;
}

const STATUSES: { value: OrderStatus; label: string; dot: string; badge: string }[] = [
  { value: 'placed',    label: 'Placed',    dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700' },
  { value: 'sent',      label: 'Sent',      dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700' },
  { value: 'delivered', label: 'Delivered', dot: 'bg-green-400',  badge: 'bg-green-50 text-green-700' },
];

function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUSES.find(s => s.value === status)!;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function fmt(currency: string, pence: number | null) {
  if (pence == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(pence / 100);
}

function fmtDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(unix: number) {
  return new Date(unix * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function OrdersPage() {
  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [hasMore, setHasMore]       = useState(false);
  const [cursor, setCursor]         = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [updating, setUpdating]     = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  async function load(cur?: string) {
    const url = cur ? `/api/admin/orders?cursor=${cur}` : '/api/admin/orders';
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return;
    const data = await r.json();
    setOrders(prev => cur ? [...prev, ...data.orders] : data.orders);
    setHasMore(data.hasMore);
    setCursor(data.nextCursor);
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    await load(cursor);
    setLoadingMore(false);
  }

  async function setStatus(id: string, status: OrderStatus) {
    const order = orders.find(o => o.id === id);
    const trackingNumber = trackingInputs[id]?.trim() || order?.trackingNumber || undefined;

    // Sending the dispatch email without a tracking number means the
    // customer never gets one — force it in before the status can flip.
    if (status === 'sent' && !trackingNumber) {
      alert('Enter an InPost tracking number before marking this order as Sent.');
      return;
    }

    const prevStatus = order?.status;
    setUpdating(id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status, trackingNumber: trackingNumber ?? o.trackingNumber } : o));
    const r = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, trackingNumber }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      alert(data.error ?? 'Failed to update status.');
      if (prevStatus) setOrders(prev => prev.map(o => o.id === id ? { ...o, status: prevStatus } : o));
    }
    setUpdating(null);
  }

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
          <p className="mt-0.5 text-sm text-gray-400">Live from Stripe</p>
        </div>
        <p className="text-sm text-gray-400">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && orders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-sm font-medium text-gray-500">No orders yet</p>
          <p className="mt-1 text-sm text-gray-400">Completed Stripe checkout sessions will appear here.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="grid grid-cols-[1fr_160px_120px_130px_100px_40px] gap-4 border-b border-gray-100 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <span>Customer</span>
            <span>Items</span>
            <span>Date</span>
            <span>Status</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {orders.map((order, i) => (
            <div key={order.id} className={i < orders.length - 1 ? 'border-b border-gray-50' : ''}>
              <button
                onClick={() => toggle(order.id)}
                className="grid w-full grid-cols-[1fr_160px_120px_130px_100px_40px] gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{order.customer.name}</p>
                  <p className="truncate text-xs text-gray-400">{order.customer.email}</p>
                </div>
                <div className="min-w-0 self-center">
                  <p className="truncate text-sm text-gray-700">
                    {order.items.map(i => i.description).join(', ') || '—'}
                  </p>
                  {order.items[0]?.variant && (
                    <p className="truncate text-xs text-gray-400">{order.items.map(i => i.variant).join(', ')}</p>
                  )}
                </div>
                <div className="self-center">
                  <p className="text-sm text-gray-700">{fmtDate(order.created)}</p>
                  <p className="text-xs text-gray-400">{fmtTime(order.created)}</p>
                </div>
                <div className="self-center">
                  <StatusBadge status={order.status} />
                </div>
                <div className="self-center text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {fmt(order.currency ?? 'gbp', order.total)}
                  </p>
                </div>
                <div className="flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className={`text-gray-300 transition-transform ${expanded === order.id ? 'rotate-180' : ''}`}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
              </button>

              {expanded === order.id && (
                <div className="border-t border-gray-50 bg-gray-50/60 px-6 py-5">
                  <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                    {/* Items */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Items</p>
                      <div className="space-y-3">
                        {order.items.map((item, j) => (
                          <div key={j} className="flex items-center gap-3">
                            {item.image && (
                              <img src={item.image} alt={item.description ?? ''} className="h-12 w-12 rounded-lg object-cover" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {item.description}
                                {(item.quantity ?? 1) > 1 && <span className="ml-1 font-normal text-gray-400">×{item.quantity}</span>}
                              </p>
                              {item.variant && <p className="text-xs text-gray-400">{item.variant}</p>}
                            </div>
                            <p className="shrink-0 text-sm text-gray-900">{fmt(item.currency, item.total)}</p>
                          </div>
                        ))}
                        {order.subtotal !== order.total && (
                          <div className="flex justify-between border-t border-gray-200 pt-1.5">
                            <p className="text-xs text-gray-400">Subtotal</p>
                            <p className="text-xs text-gray-500">{fmt(order.currency ?? 'gbp', order.subtotal)}</p>
                          </div>
                        )}
                        <div className="flex justify-between font-medium">
                          <p className="text-sm text-gray-700">Total</p>
                          <p className="text-sm text-gray-900">{fmt(order.currency ?? 'gbp', order.total)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Shipping */}
                    {order.shipping && (
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Ship to</p>
                        <div className="text-sm leading-relaxed text-gray-700">
                          <p>{order.customer.name}</p>
                          {order.shipping.line1 && <p>{order.shipping.line1}</p>}
                          {order.shipping.line2 && <p>{order.shipping.line2}</p>}
                          {order.shipping.city && <p>{order.shipping.city}{order.shipping.postal_code ? `, ${order.shipping.postal_code}` : ''}</p>}
                          {order.shipping.country && <p>{order.shipping.country}</p>}
                        </div>
                      </div>
                    )}

                    {/* Status + contact */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Update status</p>
                      <div className="flex flex-col gap-1.5">
                        {STATUSES.map(s => {
                          const needsTracking = s.value === 'sent' && !(trackingInputs[order.id]?.trim() || order.trackingNumber);
                          return (
                            <button
                              key={s.value}
                              disabled={updating === order.id || needsTracking}
                              title={needsTracking ? 'Enter an InPost tracking number first' : undefined}
                              onClick={e => { e.stopPropagation(); setStatus(order.id, s.value); }}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                                order.status === s.value
                                  ? `${s.badge} font-medium`
                                  : needsTracking
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-500 hover:bg-gray-100'
                              }`}
                            >
                              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                              {s.label}
                            </button>
                          );
                        })}
                      </div>

                      <p className="mb-1 mt-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">InPost tracking number</p>
                      <input
                        type="text"
                        value={trackingInputs[order.id] ?? order.trackingNumber ?? ''}
                        onChange={e => setTrackingInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                        onClick={e => e.stopPropagation()}
                        placeholder="e.g. CS123456789GB"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
                      />
                      <p className="mt-1 text-[11px] text-gray-400">Included in the dispatch email when you mark this order "Sent".</p>

                      <p className="mb-1 mt-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Contact</p>
                      <p className="text-sm text-gray-700">{order.customer.email}</p>
                      <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Order ID</p>
                      <p className="font-mono text-xs text-gray-400">{order.id}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
