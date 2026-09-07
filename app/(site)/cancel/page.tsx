import Link from 'next/link';

export const metadata = {
  title: 'Order Cancelled | The Break Surf',
  robots: { index: false, follow: false },
};

export default function CancelPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-32 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-terra/10">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#C4622D"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>

      <h1 className="font-display text-3xl font-medium text-charcoal">Payment cancelled</h1>
      <p className="mt-3 text-sm leading-relaxed text-charcoal/60">
        No worries — your bag is still saved. Head back whenever you&apos;re ready.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/cart"
          className="rounded-sm bg-terra px-8 py-3.5 text-sm font-medium text-cream hover:bg-terra/90"
        >
          Back to bag
        </Link>
        <Link
          href="/products"
          className="rounded-sm border border-charcoal/20 px-8 py-3.5 text-sm font-medium text-charcoal hover:border-charcoal"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
