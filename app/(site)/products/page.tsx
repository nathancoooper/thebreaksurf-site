import { Suspense } from 'react';
import { Product } from '@/types';
import { readData } from '@/lib/dataCache';
import { getDiscountMap } from '@/lib/promotions';
import ShopContent from './ShopContent';
import ShopGrid from './ShopGrid';

export const metadata = {
  title: 'Shop | The Break Surf',
  description: 'Shop outdoor clothing and accessories from The Break Surf — made in small batches for the trail and beyond.',
};

// Safety net: no dynamic segment here, so this always gets pre-rendered at
// `docker build` time from whatever's committed to git, not the live
// volume — revalidatePath fixes it instantly on a real edit, but this
// bounds the staleness window even if that never happens.
export const revalidate = 300;

export default async function ShopPage() {
  const allProducts = await readData<Product>('products');
  const discounts = await getDiscountMap(allProducts.map(p => p.id));
  return (
    <Suspense fallback={<ShopGrid allProducts={allProducts} category={null} discounts={discounts} />}>
      <ShopContent allProducts={allProducts} discounts={discounts} />
    </Suspense>
  );
}
