'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { Product } from '@/types';

interface Props {
  product: Product;
  discountPercent?: number;
}

export default function ProductCard({ product, discountPercent = 0 }: Props) {
  const price = (product.price / 100).toFixed(2);
  const salePrice = discountPercent > 0
    ? ((product.price * (1 - discountPercent / 100)) / 100).toFixed(2)
    : null;

  // One zone per colour: use colour cover → colour gallery[0] → default cover
  const variants = product.colors.map(color => {
    const cd = product.images.colors?.[color];
    const src = cd?.cover || cd?.gallery?.[0] || product.images.cover;
    return { color, src };
  });
  // Fall back to a single zone (no scrubbing) if no colours defined
  if (variants.length === 0) variants.push({ color: '', src: product.images.cover });

  const [activeIdx, setActiveIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const touchStartX = useRef<number | null>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (variants.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const zone = Math.floor(((e.clientX - rect.left) / rect.width) * variants.length);
    setActiveIdx(Math.min(Math.max(zone, 0), variants.length - 1));
  }

  function handleMouseLeave() {
    setActiveIdx(0);
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (variants.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const zone = Math.floor(((e.touches[0].clientX - rect.left) / rect.width) * variants.length);
    setActiveIdx(Math.min(Math.max(zone, 0), variants.length - 1));
  }

  function handleTouchEnd() {
    touchStartX.current = null;
    setActiveIdx(0);
  }

  const activeColor = variants[activeIdx].color;
  const href = `/products/${product.id}${activeColor ? `?color=${encodeURIComponent(activeColor)}` : ''}`;

  return (
    <Link href={href} className="group block">
      <div className="overflow-hidden rounded-sm bg-cream/60">
        {/* Image area */}
        <div
          className="relative aspect-[3/4] w-full overflow-hidden bg-sage/15"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Skeleton placeholder */}
          {!loaded && (
            <div className="absolute inset-0 skeleton" />
          )}
          
          {/* Single zoom wrapper — scale lives here so image swaps never interrupt the animation */}
          <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105">
            {variants.map((v, i) => (
              <Image
                key={v.src}
                src={v.src}
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className={`object-cover transition-opacity duration-150 ${
                  i === activeIdx ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setLoaded(true)}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ))}
          </div>

          {/* Zone indicators — subtle dots at the bottom when multiple variants exist */}
          {variants.length > 1 && (
            <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 transition-opacity duration-200 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
              {variants.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 w-1 rounded-full transition-colors duration-150 ${
                    i === activeIdx ? 'bg-cream' : 'bg-cream/40'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Category pill */}
          <span className="absolute left-3 top-3 rounded-full bg-cream/90 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-widest text-charcoal/70">
            {product.category}
          </span>

          {/* Sale badge */}
          {salePrice && (
            <span className="absolute right-3 top-3 rounded-full bg-terra px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-widest text-cream">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Details */}
        <div className="px-1 pb-4 pt-3">
          <h3 className="font-display text-base font-medium text-charcoal transition-colors group-hover:text-terra">
            {product.name}
          </h3>
          <p className="mt-0.5 text-sm text-charcoal/60">
            {product.colors.slice(0, 3).join(' · ')}
            {product.colors.length > 3 && ' · …'}
          </p>
          {salePrice ? (
            <p className="mt-2 flex items-baseline gap-2 text-sm">
              <span className="font-semibold text-terra">£{salePrice}</span>
              <span className="text-charcoal/40 line-through">£{price}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm font-semibold text-charcoal">£{price}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
