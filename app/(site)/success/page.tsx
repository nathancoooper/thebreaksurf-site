'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useCart } from '@/contexts/CartContext';

export default function SuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="mx-auto max-w-lg px-6 py-32 text-center">
      {/* Check mark */}
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-forest/10">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2A4A1E"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="font-display text-3xl font-medium text-charcoal">Order confirmed</h1>
      <p className="mt-3 text-sm leading-relaxed text-charcoal/60">
        Thank you for your order. You&apos;ll receive a confirmation email shortly with tracking
        details once your piece is on its way.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/products"
          className="rounded-sm bg-terra px-8 py-3.5 text-sm font-medium text-cream hover:bg-terra/90"
        >
          Continue shopping
        </Link>
        <Link
          href="/"
          className="rounded-sm border border-charcoal/20 px-8 py-3.5 text-sm font-medium text-charcoal hover:border-charcoal"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
