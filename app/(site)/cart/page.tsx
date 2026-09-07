'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { useState, useEffect } from 'react';

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discounts, setDiscounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const reset = () => { if (document.visibilityState === 'visible') setLoading(false); };
    document.addEventListener('visibilitychange', reset);
    return () => document.removeEventListener('visibilitychange', reset);
  }, []);

  // Display-only — checkout always recomputes discounts fresh server-side,
  // this just keeps the cart's own preview accurate against active promotions.
  useEffect(() => {
    fetch('/api/promotions').then(r => r.json()).then(setDiscounts).catch(() => {});
  }, []);

  function unitPrice(productId: string, basePrice: number) {
    const pct = discounts[productId] ?? 0;
    return pct > 0 ? Math.round(basePrice * (1 - pct / 100)) : basePrice;
  }

  const discountedTotal = items.reduce(
    (sum, i) => sum + unitPrice(i.product.id, i.product.price) * i.quantity,
    0
  );
  const savings = total - discountedTotal;

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Checkout failed');
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <p className="font-display text-2xl text-charcoal">Your bag is empty</p>
        <p className="mt-2 text-sm text-charcoal/60">
          Looks like you haven&apos;t added anything yet.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-block rounded-sm bg-terra px-8 py-3.5 text-sm font-medium text-cream hover:bg-terra/90"
        >
          Shop the collection
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-charcoal">Your bag</h1>
        <button
          onClick={clearCart}
          className="text-xs text-charcoal/40 underline underline-offset-4 hover:text-charcoal"
        >
          Clear bag
        </button>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Item list */}
        <div className="lg:col-span-2">
          <div className="divide-y divide-charcoal/10">
            {items.map(item => (
              <div
                key={`${item.product.id}-${item.size}-${item.color}`}
                className="flex gap-4 py-5"
              >
                {/* Image thumbnail */}
                <div className="h-24 w-20 shrink-0 overflow-hidden rounded-sm bg-sage/15 placeholder-bg">
                  <div className="relative h-full w-full">
                    <Image
                      src={item.product.images.colors?.[item.color]?.cover ?? item.product.images.cover}
                      alt={item.product.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/products/${item.product.id}`}
                        className="font-display text-sm font-medium text-charcoal hover:text-terra"
                      >
                        {item.product.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-charcoal/50">
                        {item.color} · {item.size}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-charcoal">
                        £{((unitPrice(item.product.id, item.product.price) * item.quantity) / 100).toFixed(2)}
                      </p>
                      {discounts[item.product.id] > 0 && (
                        <p className="text-xs text-charcoal/40 line-through">
                          £{((item.product.price * item.quantity) / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4">
                    {/* Quantity */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            item.size,
                            item.color,
                            item.quantity - 1
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-charcoal/20 text-sm hover:border-charcoal"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            item.size,
                            item.color,
                            item.quantity + 1
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-charcoal/20 text-sm hover:border-charcoal"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        removeItem(item.product.id, item.size, item.color)
                      }
                      className="text-xs text-charcoal/40 hover:text-terra"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order summary */}
        <div>
          <div className="rounded-sm border border-charcoal/10 p-6">
            <h2 className="font-display text-lg font-medium text-charcoal">Order summary</h2>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-charcoal/70">
                <span>Subtotal</span>
                <span>£{(discountedTotal / 100).toFixed(2)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-terra">
                  <span>Promotion savings</span>
                  <span>-£{(savings / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-charcoal/70">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
            </div>

            <div className="mt-4 border-t border-charcoal/10 pt-4">
              <div className="flex justify-between font-medium text-charcoal">
                <span>Total</span>
                <span>£{(discountedTotal / 100).toFixed(2)}</span>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs text-red-600">{error}</p>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="mt-6 w-full rounded-sm bg-terra py-3.5 text-sm font-medium text-cream transition-all hover:bg-terra/90 hover:shadow-md disabled:opacity-60"
            >
              {loading ? 'Redirecting…' : 'Checkout with Stripe'}
            </button>

            <p className="mt-3 text-center text-[10px] text-charcoal/40">
              Secure payment handled by Stripe
            </p>
          </div>

          <Link
            href="/products"
            className="mt-4 block text-center text-xs text-charcoal/50 underline underline-offset-4 hover:text-charcoal"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
