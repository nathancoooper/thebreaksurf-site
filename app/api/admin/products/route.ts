import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { revalidatePath } from 'next/cache';
import { purgeAndWarm } from '@/lib/cloudflareCache';
import { readData, writeData } from '@/lib/dataCache';
import { Product } from '@/types';

export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  return NextResponse.json(await readData<Product>('products'));
}

export async function POST(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  const product: Product = await request.json();
  if (!product.id || !product.name) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
  }

  const products = await readData<Product>('products');
  if (products.some(p => p.id === product.id)) {
    return NextResponse.json({ error: 'A product with that ID already exists' }, { status: 409 });
  }

  await writeData('products', product);
  revalidatePath('/', 'layout');
  revalidatePath('/products');
  purgeAndWarm(['/', '/products', `/products/${product.id}`]).catch(() => {});
  return NextResponse.json({ ok: true });
}
