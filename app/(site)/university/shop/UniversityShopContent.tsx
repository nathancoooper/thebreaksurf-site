'use client';

import Link from 'next/link';
import Logo from '@/components/Logo';
import ProductCard from '@/components/ProductCard';
import { Product } from '@/types';

export default function UniversityShopContent({ products, discounts }: { products: Product[]; discounts: Record<string, number> }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      {/* ── Co-branded header ── */}
      <header className="shrink-0 border-b border-charcoal/10 bg-cream">
        <div className="flex items-center justify-center gap-3 px-4 py-5">
          <Link href="/university" className="flex items-center gap-3">
            <Logo className="h-8 w-auto text-charcoal/80" />
            <span className="text-sm text-charcoal/40">x</span>
            <div
              role="img"
              aria-label="Arts University Bournemouth"
              className="h-5 w-[6.5rem] bg-charcoal/80"
              style={{
                WebkitMaskImage: 'url(/images/aub-logo-white.svg)',
                maskImage: 'url(/images/aub-logo-white.svg)',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
              }}
            />
          </Link>
        </div>
      </header>

      {/* ── Shop ── */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <div className="mb-10">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-terra">University Collection</p>
          <h1 className="text-4xl font-bold tracking-tight text-charcoal">The Break × AUB</h1>
          <p className="mt-2 text-sm text-charcoal/60">
            Pre-made university branded garments, ready to go.
          </p>
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-charcoal/50">No university products yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map(product => (
              <ProductCard key={product.id} product={product} discountPercent={discounts[product.id] ?? 0} />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="shrink-0 border-t border-charcoal/10 px-4 py-6 text-center">
        <p className="text-xs text-charcoal/40">
          Questions? Email{' '}
          <a href="mailto:nathan@thebreaksurf.co.uk" className="underline underline-offset-2 hover:text-charcoal">
            nathan@thebreaksurf.co.uk
          </a>
        </p>
      </footer>
    </div>
  );
}
