import { NextRequest, NextResponse } from 'next/server';
import { getSubmissionByToken, bookPickupSlot } from '@/lib/universitySubmissions';
import { listSlots, slotBookingCounts } from '@/lib/pickupSlots';

// Public (token is the secret): week-view data for one submission.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const submission = await getSubmissionByToken(token);
  if (!submission) return NextResponse.json({ error: 'Link not recognised' }, { status: 404 });

  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [slots, counts] = await Promise.all([listSlots(), slotBookingCounts()]);
  const upcoming = slots
    .filter(s => {
      const start = new Date(s.startsAt);
      return start > now && start <= horizon;
    })
    .map(s => {
      const booked = counts[s.id] ?? 0;
      const mine = submission.pickupSlotId === s.id;
      return {
        id: s.id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        note: s.note,
        capacity: s.capacity,
        booked,
        mine,
        remaining: Math.max(0, s.capacity - booked + (mine ? 1 : 0)),
      };
    });

  return NextResponse.json({
    studentName: submission.studentName,
    garment: submission.garment,
    ready: submission.completed,
    currentSlotId: submission.pickupSlotId ?? null,
    pickupBookedAt: submission.pickupBookedAt ?? null,
    slots: upcoming,
  });
}

// Public: book (or re-book) a slot via the emailed link.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const submission = await getSubmissionByToken(token);
  if (!submission) return NextResponse.json({ error: 'Link not recognised' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const slotId = typeof body?.slotId === 'string' ? body.slotId : '';
  if (!slotId) return NextResponse.json({ error: 'Choose a slot' }, { status: 400 });

  const [slots, counts] = await Promise.all([listSlots(), slotBookingCounts()]);
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  if (new Date(slot.startsAt).getTime() < Date.now()) {
    return NextResponse.json({ error: 'That slot has passed' }, { status: 400 });
  }

  const booked = await bookPickupSlot(
    submission.id,
    slot.id,
    slot.capacity,
    counts[slot.id] ?? 0,
    submission.pickupSlotId === slot.id,
  );
  if (!booked) return NextResponse.json({ error: 'That slot is full' }, { status: 409 });
  return NextResponse.json({ ok: true, slotId: slot.id });
}
