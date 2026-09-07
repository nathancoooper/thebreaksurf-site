import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData, writeData, deleteData } from '@/lib/dataCache';
import type { Design } from '../route';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const body = await req.json();
  const designs = await readData<Design>('designs');
  const existing = designs.find(d => d.id === id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await writeData('designs', { ...existing, ...body, id });
  return NextResponse.json({ ...existing, ...body, id });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const designs = await readData<Design>('designs');
  if (!designs.some(d => d.id === id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await deleteData('designs', id);
  return NextResponse.json({ ok: true });
}
