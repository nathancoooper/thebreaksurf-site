import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { revalidatePath } from 'next/cache';
import { purgeAndWarm } from '@/lib/cloudflareCache';
import { readData, writeData } from '@/lib/dataCache';
import type { Promotion, Product } from '@/types';

async function revalidateForPromotion(promo: Promotion) {
  revalidatePath('/', 'layout');
  revalidatePath('/products');
  const paths = ['/', '/products', '/api/promotions'];

  if (promo.scope === 'all') {
    const products = await readData<Product>('products');
    for (const p of products) {
      revalidatePath(`/products/${p.id}`);
      paths.push(`/products/${p.id}`);
    }
  } else {
    for (const id of promo.productIds ?? []) {
      revalidatePath(`/products/${id}`);
      paths.push(`/products/${id}`);
    }
  }

  purgeAndWarm(paths).catch(() => {});
}

export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  return NextResponse.json(await readData<Promotion>('promotions'));
}

export async function POST(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  const body = await request.json();
  const { label, discountPercent, scope, productIds, startDate, endDate } = body;

  if (!label || !discountPercent || !startDate || !endDate) {
    return NextResponse.json({ error: 'label, discountPercent, startDate and endDate are required' }, { status: 400 });
  }
  if (scope === 'products' && (!Array.isArray(productIds) || productIds.length === 0)) {
    return NextResponse.json({ error: 'Select at least one product' }, { status: 400 });
  }

  const promo: Promotion = {
    id: `promo-${Date.now()}`,
    label,
    discountPercent: Number(discountPercent),
    scope: scope === 'products' ? 'products' : 'all',
    productIds: scope === 'products' ? productIds : undefined,
    startDate,
    endDate,
  };
  await writeData('promotions', promo);
  await revalidateForPromotion(promo);

  return NextResponse.json({ ok: true, id: promo.id });
}
