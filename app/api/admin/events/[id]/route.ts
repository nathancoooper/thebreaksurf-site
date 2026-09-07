import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { revalidatePath } from 'next/cache';
import { purgeAndWarm } from '@/lib/cloudflareCache';
import { readData, writeData, deleteData } from '@/lib/dataCache';
import { Event } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const events = await readData<Event>('events');
  const event = events.find(e => e.id === id);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(event);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const updated: Event = await request.json();

  const events = await readData<Event>('events');
  if (!events.some(e => e.id === id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await writeData('events', { ...updated, id });
  revalidatePath('/');
  revalidatePath('/events');
  purgeAndWarm(['/', '/events']).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;

  const events = await readData<Event>('events');
  if (!events.some(e => e.id === id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteData('events', id);
  revalidatePath('/');
  revalidatePath('/events');
  purgeAndWarm(['/', '/events']).catch(() => {});
  return NextResponse.json({ ok: true });
}
