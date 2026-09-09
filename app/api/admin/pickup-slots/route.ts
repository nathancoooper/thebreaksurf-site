import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { createSlot, listSlotsWithCounts } from '@/lib/pickupSlots';

export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  return NextResponse.json(await listSlotsWithCounts());
}

export async function POST(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const body = await request.json().catch(() => null);
  const startsAt = typeof body?.startsAt === 'string' ? body.startsAt : '';
  const endsAt = typeof body?.endsAt === 'string' ? body.endsAt : '';
  const capacity = Number(body?.capacity);
  const note = typeof body?.note === 'string' ? body.note : undefined;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (!startsAt || !endsAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'Invalid slot times' }, { status: 400 });
  }
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 200) {
    return NextResponse.json({ error: 'Capacity must be 1–200' }, { status: 400 });
  }
  if (start.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: 'Slot must start in the future' }, { status: 400 });
  }
  const slot = await createSlot({ startsAt: start.toISOString(), endsAt: end.toISOString(), capacity, note });
  return NextResponse.json({ ...slot, booked: 0 });
}
