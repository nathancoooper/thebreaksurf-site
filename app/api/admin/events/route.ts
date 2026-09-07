import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { revalidatePath } from 'next/cache';
import { purgeAndWarm } from '@/lib/cloudflareCache';
import { readData, writeData } from '@/lib/dataCache';
import { Event } from '@/types';

export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const events = await readData<Event>('events');
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  const event: Event = await request.json();
  if (!event.id || !event.name) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
  }

  const events = await readData<Event>('events');
  if (events.some(e => e.id === event.id)) {
    return NextResponse.json({ error: 'An event with that ID already exists' }, { status: 409 });
  }

  await writeData('events', event);
  revalidatePath('/');
  revalidatePath('/events');
  purgeAndWarm(['/', '/events']).catch(() => {});
  return NextResponse.json({ ok: true });
}
