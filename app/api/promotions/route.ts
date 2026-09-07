import { NextResponse } from 'next/server';
import { getDiscountMap } from '@/lib/promotions';
import { readData } from '@/lib/dataCache';
import type { Product } from '@/types';

// Always dynamic — this needs to reflect the current date against each
// promotion's active window, not a cached snapshot from build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  const products = await readData<Product>('products');
  const discounts = await getDiscountMap(products.map(p => p.id));
  // The cart reads this on every mount to price items live — no explicit
  // header here previously meant browsers were free to apply their own
  // heuristic caching to what's meant to always be a fresh read.
  return NextResponse.json(discounts, { headers: { 'Cache-Control': 'no-store' } });
}
