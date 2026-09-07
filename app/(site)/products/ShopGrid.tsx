import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { Product } from '@/types';

export default function ShopGrid({ allProducts, category, discounts = {} }: { allProducts: Product[]; category: string | null; discounts?: Record<string, number> }) {
  const categories = ['All', ...Array.from(new Set(allProducts.map(p => p.category)))];
  const filtered = category && category !== 'All'
    ? allProducts.filter(p => p.category === category)
    : allProducts;

  return (
    <div className="mx-auto max-w-7xl px-3 py-12">
      <div className="mb-10">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-terra">Collection</p>
        <h1 className="font-display text-4xl font-medium text-charcoal">Shop</h1>
        <p className="mt-2 text-sm text-charcoal/60">
          {filtered.length} piece{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {categories.map(cat => (
          <Link
            key={cat}
            href={cat === 'All' ? '/products' : `/products?category=${cat}`}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors ${
              (cat === 'All' && !category) || category === cat
                ? 'border-forest bg-forest text-cream'
                : 'border-charcoal/20 text-charcoal/70 hover:border-forest hover:text-forest'
            }`}
          >
            {cat}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map(product => (
          <ProductCard key={product.id} product={product} discountPercent={discounts[product.id] ?? 0} />
        ))}
      </div>
    </div>
  );
}
