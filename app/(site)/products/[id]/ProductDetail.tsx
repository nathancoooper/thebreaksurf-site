'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product, Review } from '@/types';
import { useCart } from '@/contexts/CartContext';
import ScrollToTop from '@/components/ScrollToTop';
import StarRating from '@/components/StarRating';
import ReviewForm from '@/components/ReviewForm';
import ProductCard from '@/components/ProductCard';

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  grass:    { bg: '#5B8A3C', text: '#fff', border: '#5B8A3C' },
  sky:      { bg: '#6AAFD6', text: '#fff', border: '#6AAFD6' },
  daffodil: { bg: '#E8C030', text: '#3a3028', border: '#E8C030' },
  charcoal: { bg: '#4A4A4A', text: '#fff', border: '#4A4A4A' },
  sand:     { bg: '#C8AA78', text: '#3a3028', border: '#C8AA78' },
  ocean:    { bg: '#2E7DA8', text: '#fff', border: '#2E7DA8' },
  pine:     { bg: '#2D5A27', text: '#fff', border: '#2D5A27' },
  white:    { bg: '#F5F5F0', text: '#3a3028', border: '#ccc' },
  black:    { bg: '#1a1a1a', text: '#fff', border: '#1a1a1a' },
  red:      { bg: '#C43B3B', text: '#fff', border: '#C43B3B' },
  navy:     { bg: '#1E3A5F', text: '#fff', border: '#1E3A5F' },
  cream:    { bg: '#F5F0E8', text: '#3a3028', border: '#ccc' },
};

function colorStyle(name: string, colorHex?: Record<string, string>) {
  const hex = colorHex?.[name] ?? colorHex?.['default'];
  if (hex) return { bg: hex, text: '#fff', border: hex };
  return COLOR_MAP[name.toLowerCase()] ?? { bg: '#2A4A1E', text: '#fff', border: '#2A4A1E' };
}

export default function ProductDetail({ product, allProducts, discounts = {}, availability }: { product: Product; allProducts: Product[]; discounts?: Record<string, number>; availability?: Record<string, number> }) {
  const discountPercent = discounts[product.id] ?? 0;
  // undefined = product isn't ERPNext-linked, never blocks a sale
  const stockTracked = !!availability;
  function availableFor(color?: string, size?: string) {
    return availability?.[`${color ?? ''}|${size ?? ''}`] ?? 0;
  }
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);

  // Deep-link support (?color=red) — read client-side instead of via
  // useSearchParams() so this page can be statically prerendered without
  // needing a Suspense boundary around the whole product view.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('color');
    if (c && product.colors.includes(c)) setSelectedColor(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [added, setAdded] = useState(false);
  const [addedFading, setAddedFading] = useState(false);
  const [bagHovered, setBagHovered] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    fetch(`/api/reviews/${product.id}`)
      .then(r => r.json())
      .then(setReviews)
      .catch(() => {});
  }, [product.id]);

  const price = (product.price / 100).toFixed(2);
  const salePrice = discountPercent > 0
    ? ((product.price * (1 - discountPercent / 100)) / 100).toFixed(2)
    : null;

  const currentAvailable = availableFor(selectedColor, selectedSize);
  const soldOut = stockTracked && currentAvailable <= 0;

  const colorImages = product.images.colors?.[selectedColor];
  const activeGallery = colorImages?.gallery ?? product.images.gallery;
  const galleryImages = [0, 1, 2, 3].map(i => activeGallery[i] ?? colorImages?.cover ?? product.images.cover);

  const handleAdd = () => {
    if (soldOut) return;
    addItem(product, selectedSize, selectedColor);
    setAdded(true);
    setTimeout(() => {
      setAddedFading(true);
      setAdded(false);
      setTimeout(() => setAddedFading(false), 500);
    }, 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <ScrollToTop />
      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-cream/10 p-3 text-cream hover:bg-cream/20 transition-colors"
            onClick={e => { e.stopPropagation(); setLightbox(l => l !== null ? (l + 3) % 4 : 0); }}
            aria-label="Previous image"
          >
            ←
          </button>

          <img
            src={galleryImages[lightbox]}
            alt={`${product.name} ${lightbox + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-sm object-contain"
            onClick={e => e.stopPropagation()}
          />

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-cream/10 p-3 text-cream hover:bg-cream/20 transition-colors"
            onClick={e => { e.stopPropagation(); setLightbox(l => l !== null ? (l + 1) % 4 : 0); }}
            aria-label="Next image"
          >
            →
          </button>

          <button
            className="absolute right-4 top-4 rounded-full bg-cream/10 px-3 py-1.5 text-xs font-medium text-cream hover:bg-cream/20 transition-colors"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            ✕ Close
          </button>

          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
            {galleryImages.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setLightbox(i); }}
                className={`h-1.5 rounded-full transition-all ${i === lightbox ? 'w-6 bg-cream' : 'w-1.5 bg-cream/40'}`}
                aria-label={`View image ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-xs text-charcoal/50">
        <Link href="/" className="hover:text-charcoal">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-charcoal">Shop</Link>
        <span>/</span>
        <span className="text-charcoal">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr]">
        {/* Image gallery */}
        <div className="aspect-[3/4] w-full">
          <div className="grid h-full grid-cols-2 grid-rows-2 gap-2">
            {galleryImages.map((src, i) => (
              <button
                key={i}
                onClick={() => setLightbox(i)}
                className="group overflow-hidden rounded-sm bg-sage/15 placeholder-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-terra"
              >
                <div className="relative h-full w-full">
                  <Image
                    src={src}
                    alt={`${product.name} ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <p className="text-xs font-medium uppercase tracking-widest text-terra">
            {product.category}
          </p>
          <h1 className="font-display mt-2 text-3xl font-medium text-charcoal sm:text-4xl">
            {product.name}
          </h1>
          {salePrice ? (
            <p className="mt-3 flex items-baseline gap-3">
              <span className="text-xl font-semibold text-terra">£{salePrice}</span>
              <span className="text-base text-charcoal/40 line-through">£{price}</span>
              <span className="rounded-full bg-terra px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-widest text-cream">
                -{discountPercent}%
              </span>
            </p>
          ) : (
            <p className="mt-3 text-xl font-semibold text-charcoal">£{price}</p>
          )}

          <p className="mt-5 text-sm leading-relaxed text-charcoal/70">{product.description}</p>

          {/* Color selector */}
          {product.colors.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-charcoal/60">
                Colour — <span className="text-charcoal">{selectedColor}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map(color => {
                  const active = selectedColor === color;
                  const cs = colorStyle(color, product.colorHex);
                  return (
                    <button
                      type="button"
                      key={color}
                      onPointerDown={() => setSelectedColor(color)}
                      className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-all ${
                        active ? '' : 'border-charcoal/20 text-charcoal/70 hover:border-charcoal/50'
                      }`}
                      style={active ? { background: cs.bg, color: cs.text, borderColor: cs.border } : {}}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size selector */}
          {product.sizes.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-charcoal/60">
                Size — <span className="text-charcoal">{selectedSize}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map(size => {
                  const active = selectedSize === size;
                  const cs = colorStyle(selectedColor, product.colorHex);
                  const unavailable = stockTracked && availableFor(selectedColor, size) <= 0;
                  return (
                    <button
                      type="button"
                      key={size}
                      onPointerDown={() => setSelectedSize(size)}
                      disabled={unavailable}
                      title={unavailable ? 'Sold out in this size' : undefined}
                      className={`min-w-[3rem] rounded-sm border px-3 py-2 text-xs font-medium transition-all ${
                        unavailable
                          ? 'cursor-not-allowed border-charcoal/10 text-charcoal/30 line-through'
                          : active ? '' : 'border-charcoal/20 text-charcoal/70 hover:border-charcoal/50'
                      }`}
                      style={active && !unavailable ? { background: cs.bg, color: cs.text, borderColor: cs.border } : {}}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add to bag */}
          <button
            onClick={handleAdd}
            onMouseEnter={() => setBagHovered(true)}
            onMouseLeave={() => setBagHovered(false)}
            disabled={soldOut}
            className="mt-8 w-full rounded-sm py-4 text-sm font-medium tracking-wide transition-[background,color,outline,opacity] duration-500 disabled:cursor-not-allowed"
            style={(() => {
              const accent = colorStyle(selectedColor, product.colorHex).bg;
              if (soldOut) return { background: '#E5E0D5', color: '#8A8577' };
              if (added) return { background: accent, color: '#F2EDE3', opacity: 1 };
              if (addedFading) return { background: accent, color: '#F2EDE3', opacity: 0 };
              if (bagHovered) return { background: 'transparent', color: '#1C1C1C', outline: `2px solid ${accent}`, outlineOffset: '-2px' };
              return { background: accent, color: '#F2EDE3' };
            })()}
          >
            {soldOut ? 'Sold out' : added ? '✓ Added to bag' : 'Add to bag'}
          </button>

          {/* Details */}
          <div className="mt-8 border-t border-charcoal/10 pt-6">
            <h3 className="font-display text-sm font-medium text-charcoal">Details</h3>
            <ul className="mt-3 space-y-1.5">
              {product.details.map(detail => (
                <li key={detail} className="flex items-start gap-2 text-sm text-charcoal/60">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-terra" />
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="mt-20 border-t border-charcoal/10 pt-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[3fr_2fr]">
          <div>
            <h2 className="font-display text-xl font-medium text-charcoal">
              Reviews
              {reviews.length > 0 && (
                <span className="ml-2 text-sm font-normal text-charcoal/40">({reviews.length})</span>
              )}
            </h2>

            {reviews.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <StarRating
                  rating={reviews.reduce((s, r) => s + r.rating, 0) / reviews.length}
                  size={16}
                  color={colorStyle(selectedColor, product.colorHex).bg}
                />
                <span className="text-sm text-charcoal/60">
                  {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} out of 5
                </span>
              </div>
            )}

            {reviews.length === 0 ? (
              <p className="mt-4 text-sm text-charcoal/50">No reviews yet — be the first!</p>
            ) : (
              <div className="mt-6 space-y-6">
                {reviews.map(r => (
                  <div key={r.id} className="border-b border-charcoal/10 pb-6 last:border-0">
                    <div className="flex items-center gap-3">
                      <StarRating rating={r.rating} size={14} color={colorStyle(selectedColor, product.colorHex).bg} />
                      <span className="text-xs font-medium text-charcoal">{r.name}</span>
                      <span className="text-xs text-charcoal/40">
                        {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-charcoal/70">{r.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-display text-xl font-medium text-charcoal">Write a review</h2>
            <div className="mt-6">
              <ReviewForm productId={product.id} color={colorStyle(selectedColor, product.colorHex).bg} />
            </div>
          </div>
        </div>
      </div>

      {/* You might also like */}
      {(() => {
        const sameCategory = allProducts
          .filter(p => p.id !== product.id && p.category === product.category)
          .slice(0, 2);
        const sameCategoryIds = new Set(sameCategory.map(p => p.id));
        const others = allProducts
          .filter(p => p.id !== product.id && !sameCategoryIds.has(p.id))
          .sort(() => Math.random() - 0.5)
          .slice(0, 6 - sameCategory.length);
        const fallback = [...sameCategory, ...others];
        if (fallback.length === 0) return null;
        return (
          <div className="mt-20 border-t border-charcoal/10 pt-12 pb-4">
            <h2 className="font-display text-2xl font-medium text-charcoal">You might also like</h2>
            <div className="mt-8 flex gap-5 overflow-x-auto scrollbar-none">
              {fallback.map(p => (
                <div key={p.id} className="w-56 shrink-0 lg:w-64">
                  <ProductCard product={p} discountPercent={discounts[p.id] ?? 0} />
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
