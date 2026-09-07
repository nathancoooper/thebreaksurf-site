import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { revalidatePath } from 'next/cache';
import { purgeAndWarm } from '@/lib/cloudflareCache';
import { readData, writeData, deleteData } from '@/lib/dataCache';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const promos = await readData<Promotion>('promotions');
  const promo = promos.find(p => p.id === id);
  if (!promo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(promo);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const body = await request.json();
  const { label, discountPercent, scope, productIds, startDate, endDate } = body;

  if (scope === 'products' && (!Array.isArray(productIds) || productIds.length === 0)) {
    return NextResponse.json({ error: 'Select at least one product' }, { status: 400 });
  }

  const promos = await readData<Promotion>('promotions');
  const oldPromo = promos.find(p => p.id === id);
  if (!oldPromo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated: Promotion = {
    id,
    label,
    discountPercent: Number(discountPercent),
    scope: scope === 'products' ? 'products' : 'all',
    productIds: scope === 'products' ? productIds : undefined,
    startDate,
    endDate,
  };
  await writeData('promotions', updated);

  await revalidateForPromotion(oldPromo);
  await revalidateForPromotion(updated);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;

  const promos = await readData<Promotion>('promotions');
  const promo = promos.find(p => p.id === id);
  if (!promo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteData('promotions', id);
  await revalidateForPromotion(promo);

  return NextResponse.json({ ok: true });
}
