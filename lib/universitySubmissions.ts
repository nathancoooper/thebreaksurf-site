import { getDb } from './db';
import { SubmissionStatus, UniversitySubmission } from '@/types';

const STATUS_ORDER: SubmissionStatus[] = ['submitted', 'received', 'embroidering', 'ready', 'booked', 'collected'];

/** Resolve effective status from a submission row — backwards-compatible with old rows. */
export function effectiveStatus(s: UniversitySubmission): SubmissionStatus {
  if (s.status) return s.status;
  if (s.pickupSlotId) return 'booked';
  if (s.completed) return 'ready';
  return 'submitted';
}

/** Advance (or set) the status field. Never goes backwards. */
export async function setSubmissionStatus(id: string, status: SubmissionStatus): Promise<UniversitySubmission | null> {
  const current = await getSubmission(id);
  if (!current) return null;
  const curIdx = STATUS_ORDER.indexOf(effectiveStatus(current));
  const newIdx = STATUS_ORDER.indexOf(status);
  const next: Partial<UniversitySubmission> = { status };
  // Mirror the legacy boolean when we hit 'ready' or beyond.
  if (newIdx >= 3) next.completed = true; // 3 = 'ready'
  return patchSubmission(id, next);
}

export async function saveSubmission(submission: UniversitySubmission): Promise<void> {
  const db = getDb();
  await db.prepare(
    'INSERT INTO university_submissions (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?, updated_at = NOW()'
  )
    .bind(submission.id, JSON.stringify(submission), JSON.stringify(submission))
    .run();
}

export async function listSubmissions(): Promise<UniversitySubmission[]> {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM university_submissions ORDER BY created_at DESC')
    .all<{ data: string }>();
  return rows.results.map((r: { data: string }) => JSON.parse(r.data) as UniversitySubmission);
}

export async function updateSubmission(id: string, completed: boolean): Promise<UniversitySubmission | null> {
  const db = getDb();
  const row = await db.prepare('SELECT data FROM university_submissions WHERE id = ?')
    .bind(id)
    .first<{ data: string }>();
  if (!row) return null;
  const submission = JSON.parse(row.data) as UniversitySubmission;
  submission.completed = completed;
  await db.prepare('UPDATE university_submissions SET data = ?, updated_at = NOW() WHERE id = ?')
    .bind(JSON.stringify(submission), id)
    .run();
  return submission;
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.prepare('DELETE FROM university_submissions WHERE id = ?')
    .bind(id)
    .run();
  return result.meta.changes > 0;
}

export async function getSubmission(id: string): Promise<UniversitySubmission | null> {
  const db = getDb();
  const row = await db.prepare('SELECT data FROM university_submissions WHERE id = ?')
    .bind(id)
    .first<{ data: string }>();
  return row ? JSON.parse(row.data) as UniversitySubmission : null;
}

export async function getSubmissionByToken(token: string): Promise<UniversitySubmission | null> {
  // V001: token scan is fine at collab volumes (tens of rows, not thousands).
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM university_submissions')
    .all<{ data: string }>();
  for (const r of rows.results) {
    try {
      const s = JSON.parse(r.data) as UniversitySubmission;
      if (s.pickupToken === token) return s;
    } catch { /* skip malformed docs */ }
  }
  return null;
}

async function patchSubmission(id: string, patch: Partial<UniversitySubmission>): Promise<UniversitySubmission | null> {
  const current = await getSubmission(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  const db = getDb();
  await db.prepare('UPDATE university_submissions SET data = ?, updated_at = NOW() WHERE id = ?')
    .bind(JSON.stringify(next), id)
    .run();
  return next;
}

/** Mint (or return) the secret pickup-booking token for a submission. */
export async function ensurePickupToken(id: string): Promise<UniversitySubmission | null> {
  const current = await getSubmission(id);
  if (!current) return null;
  if (current.pickupToken) return current;
  const { randomUUID } = await import('node:crypto');
  return patchSubmission(id, { pickupToken: randomUUID().replace(/-/g, '') });
}

/** Book (or re-book) a pickup slot. Auto-advances status to 'booked'. */
export async function bookPickupSlot(
  submissionId: string,
  slotId: string,
  slotCapacity: number,
  bookedCount: number,
  alreadyOnSlot: boolean,
): Promise<UniversitySubmission | null> {
  const effective = bookedCount - (alreadyOnSlot ? 1 : 0);
  if (effective >= slotCapacity) return null;
  return patchSubmission(submissionId, {
    pickupSlotId: slotId,
    pickupBookedAt: new Date().toISOString(),
    status: 'booked',
  });
}
