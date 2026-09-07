import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData, writeData, deleteData } from '@/lib/dataCache';
import type { Person } from '../route';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const body = await req.json();
  const people = await readData<Person>('people');
  const existing = people.find(p => p.id === id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await writeData('people', { ...existing, ...body, id });
  return NextResponse.json({ ...existing, ...body, id });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const people = await readData<Person>('people');
  if (!people.some(p => p.id === id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await deleteData('people', id);
  return NextResponse.json({ ok: true });
}
