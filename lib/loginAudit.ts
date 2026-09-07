import type { NextRequest } from 'next/server';
import { getDb } from './db';

const MAX_ENTRIES = 250;

export type LoginOutcome = 'success' | 'failed_password' | 'failed_2fa';

export interface LoginAuditEntry {
  id: string;
  userId?: string;
  email: string;
  outcome: LoginOutcome;
  occurredAt: string;
  ipAddress: string;
  country?: string;
  userAgent: string;
}

function requestDetails(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    ipAddress: request.headers.get('cf-connecting-ip') ?? forwardedFor ?? 'Unknown',
    country: request.headers.get('cf-ipcountry') ?? undefined,
    userAgent: request.headers.get('user-agent') ?? 'Unknown device',
  };
}

export async function recordLoginAttempt(
  request: NextRequest,
  details: { userId?: string; email: string; outcome: LoginOutcome },
): Promise<void> {
  const entry: LoginAuditEntry = {
    id: crypto.randomUUID(),
    ...details,
    ...requestDetails(request),
    occurredAt: new Date().toISOString(),
  };

  const db = getDb();
  await db.prepare('INSERT INTO login_log (id, data, occurred_at) VALUES (?, ?, ?)')
    .bind(entry.id, JSON.stringify(entry), entry.occurredAt)
    .run();

  // Trim old entries beyond MAX_ENTRIES
  await db.prepare(
    'DELETE FROM login_log WHERE id NOT IN (SELECT id FROM login_log ORDER BY occurred_at DESC LIMIT ?)'
  )
    .bind(MAX_ENTRIES)
    .run();
}

export async function listLoginAttemptsForUser(userId: string, email: string): Promise<LoginAuditEntry[]> {
  const db = getDb();
  const normalizedEmail = email.toLowerCase();
  const rows = await db.prepare('SELECT data FROM login_log ORDER BY occurred_at DESC')
    .all<{ data: string }>();
  const entries = rows.results.map((r: { data: string }) => JSON.parse(r.data) as LoginAuditEntry);
  return entries.filter((entry: LoginAuditEntry) =>
    entry.userId === userId || (!entry.userId && entry.email.toLowerCase() === normalizedEmail),
  );
}
