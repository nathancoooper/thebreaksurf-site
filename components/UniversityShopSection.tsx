'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import type { Product } from '@/types';

function priceFmt(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function UniProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const img = product.images.cover;
  return (
    <button
      onClick={onClick}
      className="group block w-full cursor-pointer overflow-hidden rounded-lg bg-white"
      style={{ aspectRatio: '1 / 1' }}
    >
      <div className="relative h-full w-full">
        <Image
          src={img}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3">
          <p className="text-sm font-semibold text-white">{product.name}</p>
          <p className="text-xs text-white/80">{priceFmt(product.price)}</p>
        </div>
      </div>
    </button>
  );
}

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { addItem } = useCart();
  const [imgIdx, setImgIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.colors[0] ?? '');
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] ?? '');

  const colorImages = product.images.colors?.[selectedColor];
  const images = [
    ...(colorImages?.cover ? [colorImages.cover] : []),
    ...(colorImages?.gallery ?? []),
    ...(!colorImages ? [product.images.cover, ...(product.images.gallery ?? [])] : []),
  ];
  const uniqueImages = [...new Set(images)];
  const hasMultiple = uniqueImages.length > 1;

  useEffect(() => { setImgIdx(0); }, [selectedColor]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleAddToCart() {
    addItem(product, selectedSize, selectedColor);
    onClose();
  }

  function handleBuyNow() {
    addItem(product, selectedSize, selectedColor);
    window.location.href = '/cart';
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl md:flex-row"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
          aria-label="Close"
        >
          ×
        </button>

        <div className="relative w-full shrink-0 bg-charcoal/5 md:w-1/2" style={{ aspectRatio: '1 / 1' }}>
          {uniqueImages[imgIdx] && (
            <Image
              src={uniqueImages[imgIdx]}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          )}
          {hasMultiple && (
            <>
              <button
                onClick={() => setImgIdx(i => (i - 1 + uniqueImages.length) % uniqueImages.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60"
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                onClick={() => setImgIdx(i => (i + 1) % uniqueImages.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60"
                aria-label="Next image"
              >
                ›
              </button>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {uniqueImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i === imgIdx ? 'bg-white' : 'bg-white/40'
                    }`}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-terra">University</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-charcoal">{product.name}</h2>
          <p className="mt-1 text-lg font-semibold text-charcoal">{priceFmt(product.price)}</p>
          <p className="mt-3 text-sm leading-relaxed text-charcoal/60">{product.description}</p>

          {product.colors.length > 1 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-charcoal/50">Colour</p>
              <div className="flex gap-2">
                {product.colors.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`rounded-sm border px-3 py-1 text-xs transition-colors ${
                      selectedColor === c
                        ? 'border-forest bg-forest text-cream'
                        : 'border-charcoal/20 text-charcoal hover:border-charcoal/50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.sizes.length > 1 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-charcoal/50">Size</p>
              <div className="flex gap-2">
                {product.sizes.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`rounded-sm border px-3 py-1 text-xs transition-colors ${
                      selectedSize === s
                        ? 'border-forest bg-forest text-cream'
                        : 'border-charcoal/20 text-charcoal hover:border-charcoal/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.details.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-charcoal/50">
              {product.details.map((d, i) => <li key={i}>• {d}</li>)}
            </ul>
          )}

          <div className="mt-auto flex gap-2 pt-5">
            <button
              onClick={handleAddToCart}
              className="flex-1 rounded-sm border border-charcoal/20 py-2.5 text-sm font-medium text-charcoal transition-colors hover:border-charcoal/50"
            >
              Add to bag
            </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 rounded-sm bg-forest py-2.5 text-sm font-medium text-cream transition-colors hover:bg-moss"
            >
              Buy now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UniversityShopSection({ products }: { products: Product[] }) {
  const [modalProduct, setModalProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (modalProduct) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [modalProduct]);

  if (products.length === 0) return null;

  return (
    <>
      <section id="uni-shop" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 text-center">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-terra">University Collection</p>
          <h2 className="text-3xl font-bold tracking-tight text-charcoal">Shop pre-made items</h2>
          <p className="mt-2 text-sm text-charcoal/60">
            Don&rsquo;t have a garment to drop off? Grab a ready-made uni branded piece instead.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map(product => (
            <UniProductCard
              key={product.id}
              product={product}
              onClick={() => setModalProduct(product)}
            />
          ))}
        </div>
      </section>

      {modalProduct && (
        <ProductModal product={modalProduct} onClose={() => setModalProduct(null)} />
      )}
    </>
  );
}
