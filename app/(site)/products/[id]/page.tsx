import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Product } from '@/types';
import ProductDetail from './ProductDetail';
import { readData } from '@/lib/dataCache';
import { getDiscountMap } from '@/lib/promotions';
import { getAvailabilityForProducts } from '@/lib/stock';

// Empty array = nothing pre-rendered at `docker build` time (data/products.json
// is a runtime-mounted volume and would be stale git-committed seed data at
// build time), but still gets ISR treatment: the first real request to any
// product ID renders from the live volume and caches the result. Admin edits
// call revalidatePath()/purgeAndWarm() for an instant refresh, but a
// promotion's start/end date can also change what this page shows without
// any admin action happening at that moment — so unlike before promotions
// existed, this can't be revalidate: false anymore. 5 minutes bounds that
// staleness window the same way the safety-net pages already do.
export async function generateStaticParams() {
  return [];
}
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const allProducts = await readData<Product>('products');
  const product = allProducts.find(p => p.id === id);
  if (!product) return {};

  const title = `${product.name} | The Break Surf`;
  return {
    title,
    description: product.description,
    openGraph: {
      title,
      description: product.description,
      images: [{ url: product.images.cover }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: product.description,
      images: [product.images.cover],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const allProducts = await readData<Product>('products');
  const product = allProducts.find(p => p.id === id);
  if (!product) notFound();
  const discounts = await getDiscountMap(allProducts.map(p => p.id));
  const availability = await getAvailabilityForProducts([product]);
  return <ProductDetail product={product} allProducts={allProducts} discounts={discounts} availability={availability[product.id]} />;
}
