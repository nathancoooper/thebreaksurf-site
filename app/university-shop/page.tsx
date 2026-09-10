import { Product } from '@/types';
import { readData } from '@/lib/dataCache';
import { getDiscountMap } from '@/lib/promotions';
import UniversityShopContent from './UniversityShopContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'University Shop | The Break Surf',
  description: 'Pre-made university branded garments from The Break × AUB collaboration.',
};

export default async function UniversityShopPage() {
  const allProducts = await readData<Product>('products');
  const uniProducts = allProducts.filter(p => p.category === 'University');
  const discounts = await getDiscountMap(uniProducts.map(p => p.id));
  return <UniversityShopContent products={uniProducts} discounts={discounts} />;
}
