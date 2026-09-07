import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { revalidatePath } from 'next/cache';
import { purgeAndWarm } from '@/lib/cloudflareCache';
import { readData, writeData, deleteData } from '@/lib/dataCache';
import { Product } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const products = await readData<Product>('products');
  const product = products.find(p => p.id === id);
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const updated: Product = await request.json();

  const products = await readData<Product>('products');
  const existing = products.find(p => p.id === id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await writeData('products', { ...updated, id });
  revalidatePath('/', 'layout');
  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  purgeAndWarm(['/', '/products', `/products/${id}`]).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;

  const products = await readData<Product>('products');
  if (!products.some(p => p.id === id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await deleteData('products', id);
  revalidatePath('/', 'layout');
  revalidatePath('/products');
  purgeAndWarm(['/', '/products']).catch(() => {});
  return NextResponse.json({ ok: true });
}
