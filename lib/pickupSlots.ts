import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { PickupSlot, PickupSlotWithCount, UniversitySubmission } from '@/types';

export async function listSlots(): Promise<PickupSlot[]> {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM pickup_slots ORDER BY data ASC')
    .all<{ data: string }>();
  const slots = rows.results.map((r: { data: string }) => JSON.parse(r.data) as PickupSlot);
  slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return slots;
}

export async function createSlot(input: {
  startsAt: string; endsAt: string; capacity: number; note?: string;
}): Promise<PickupSlot> {
  const slot: PickupSlot = {
    id: randomUUID(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    capacity: Math.max(1, Math.floor(input.capacity)),
    note: input.note?.trim().slice(0, 200) || undefined,
    createdAt: new Date().toISOString(),
  };
  const db = getDb();
  await db.prepare('INSERT INTO pickup_slots (id, data) VALUES (?, ?)')
    .bind(slot.id, JSON.stringify(slot))
    .run();
  return slot;
}

export async function deleteSlot(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.prepare('DELETE FROM pickup_slots WHERE id = ?')
    .bind(id)
    .run();
  return result.meta.changes > 0;
}

/** Booking counts per slot, derived from submission docs (V001: no separate table). */
export async function slotBookingCounts(): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM university_submissions')
    .all<{ data: string }>();
  const counts: Record<string, number> = {};
  for (const r of rows.results) {
    try {
      const s = JSON.parse(r.data) as UniversitySubmission;
      if (s.pickupSlotId) counts[s.pickupSlotId] = (counts[s.pickupSlotId] ?? 0) + 1;
    } catch { /* skip malformed docs */ }
  }
  return counts;
}

export async function listSlotsWithCounts(): Promise<PickupSlotWithCount[]> {
  const [slots, counts] = await Promise.all([listSlots(), slotBookingCounts()]);
  return slots.map(s => ({ ...s, booked: counts[s.id] ?? 0 }));
}

/** Slots starting within the next 7 days (future only), with remaining places. */
export async function upcomingSlots(): Promise<(PickupSlotWithCount & { remaining: number })[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const slots = await listSlotsWithCounts();
  return slots
    .filter(s => {
      const start = new Date(s.startsAt);
      return start > now && start <= horizon;
    })
    .map(s => ({ ...s, remaining: Math.max(0, s.capacity - s.booked) }));
}
