'use client';

import { useSearchParams } from 'next/navigation';
import ShopGrid from './ShopGrid';
import { Product } from '@/types';

export default function ShopContent({ allProducts, discounts }: { allProducts: Product[]; discounts: Record<string, number> }) {
  const searchParams = useSearchParams();
  return <ShopGrid allProducts={allProducts} category={searchParams.get('category')} discounts={discounts} />;
}
