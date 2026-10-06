import { randomBytes } from 'crypto';
import { getDb } from './db';

// Newsletter subscribers + a datastore-backed rate limiter. The subscriber
// table is ground truth for consent; Resend's audience is a best-effort mirror
// (see app/api/subscribe/route.ts).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export interface SubscriberUpsert {
  email: string;
  brand?: string;
  source?: string;
}

export interface SubscriberUpsertResult {
  /** True when this address had never subscribed before. */
  inserted: boolean;
  /** True when a previously unsubscribed address re-opted-in. */
  reactivated: boolean;
  token: string;
}

export async function upsertSubscriber(input: SubscriberUpsert): Promise<SubscriberUpsertResult> {
  const db = getDb();
  const token = randomBytes(16).toString('hex');

  const existing = await db
    .prepare('SELECT unsubscribe_token, unsubscribed_at FROM subscribers WHERE email = ?')
    .bind(input.email)
    .first<{ unsubscribe_token: string; unsubscribed_at: Date | null }>();

  if (!existing) {
    try {
      await db
        .prepare(
          'INSERT INTO subscribers (email, brand, source, unsubscribe_token) VALUES (?, ?, ?, ?)'
        )
        .bind(input.email, input.brand ?? 'break', input.source ?? 'homepage-popup', token)
        .run();
      return { inserted: true, reactivated: false, token };
    } catch {
      // Lost a race with a concurrent subscribe for the same address — the
      // PRIMARY KEY on email caught it, fall through and treat as existing.
    }
  }

  const row = existing ?? (await db
    .prepare('SELECT unsubscribe_token, unsubscribed_at FROM subscribers WHERE email = ?')
    .bind(input.email)
    .first<{ unsubscribe_token: string; unsubscribed_at: Date | null }>());

  if (!row) {
    // Insert threw for a non-duplicate reason (or the row vanished). Don't
    // pretend it worked — the caller will surface a 500.
    throw new Error('subscriber upsert failed');
  }

  if (row.unsubscribed_at) {
    await db
      .prepare(
        'UPDATE subscribers SET unsubscribed_at = NULL, consent_at = NOW(), source = ? WHERE email = ?'
      )
      .bind(input.source ?? 'homepage-popup', input.email)
      .run();
    return { inserted: false, reactivated: true, token: row.unsubscribe_token };
  }

  return { inserted: false, reactivated: false, token: row.unsubscribe_token };
}

/** Marketing-only unsubscribe. Returns the address, or null for a bad/used token. */
export async function unsubscribeByToken(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const db = getDb();
  const row = await db
    .prepare('SELECT email FROM subscribers WHERE unsubscribe_token = ? AND unsubscribed_at IS NULL')
    .bind(token)
    .first<{ email: string }>();
  if (!row) return null;
  await db
    .prepare('UPDATE subscribers SET unsubscribed_at = NOW() WHERE unsubscribe_token = ?')
    .bind(token)
    .run();
  return row.email;
}

export interface RateRule {
  /** Scoped discriminator, e.g. `ip:1.2.3.4` or `email:a@b.c`. */
  key: string;
  max: number;
}

/**
 * Sliding-window rate limit over the rate_limits table. Returns true when the
 * request is allowed (and records it), false when any rule is exhausted.
 * Kept in the datastore rather than process memory so container restarts
 * cannot clear a limit mid-attack.
 */
export async function rateLimit(
  bucket: string,
  rules: RateRule[],
  windowMinutes = 10
): Promise<boolean> {
  const db = getDb();
  const window = Math.max(1, Math.floor(windowMinutes));

  for (const rule of rules) {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ? AND rate_key = ? AND created_at > NOW() - INTERVAL ${window} MINUTE`
      )
      .bind(bucket, rule.key)
      .first<{ n: number | string }>();
    if (Number(row?.n ?? 0) >= rule.max) return false;
  }

  for (const rule of rules) {
    await db
      .prepare('INSERT INTO rate_limits (bucket, rate_key) VALUES (?, ?)')
      .bind(bucket, rule.key)
      .run();
  }

  // Opportunistic cleanup — the table only ever holds a rolling window plus
  // stragglers, so this stays tiny.
  await db
    .prepare('DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL 7 DAY')
    .run();

  return true;
}
