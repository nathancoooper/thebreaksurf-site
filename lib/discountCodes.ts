import { randomBytes } from 'crypto';
import { getDb } from './db';

// Single-use welcome discount codes for newsletter sign-ups. Each code is tied
// to the capturing email address: redemption requires both, so a leaked/guessed
// code alone is useless (enforced in validateCode, re-checked at checkout).

export const SIGNUP_DISCOUNT_PERCENT = 10;

// Unambiguous alphabet — no 0/O, 1/I, or L. 6 chars over 31 symbols ≈ 8.9e8
// combinations; combined with the email tie and rate limits that is plenty.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_PREFIX = 'BRK-';

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = CODE_PREFIX;
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Issues a fresh code for an address. Unique-PK collision retries are silent. */
export async function mintCode(
  email: string,
  percent: number = SIGNUP_DISCOUNT_PERCENT
): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await db
        .prepare('INSERT INTO discount_codes (code, email, percent) VALUES (?, ?, ?)')
        .bind(code, email, percent)
        .run();
      return code;
    } catch {
      // Almost certainly a duplicate-code collision; retry with a fresh draw.
    }
  }
  throw new Error('could not mint a unique discount code');
}

function cleanCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

/** Newest still-unused code for an address, if any (re-activation reuses it). */
export async function findUnusedCode(email: string): Promise<string | null> {
  const db = getDb();
  const row = await db
    .prepare(
      'SELECT code FROM discount_codes WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1'
    )
    .bind(email)
    .first<{ code: string }>();
  return row?.code ?? null;
}

export interface CodeValidation {
  code: string;
  percent: number;
}

/**
 * Checks a code against the address it was issued to. Returns null for
 * unknown, already-used, or wrong-address codes — deliberately one generic
 * failure so the response can't be used to enumerate or pre-test codes.
 */
export async function validateCode(rawCode: unknown, rawEmail: unknown): Promise<CodeValidation | null> {
  const code = cleanCode(rawCode);
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!code || !email) return null;

  const db = getDb();
  const row = await db
    .prepare('SELECT email, percent, used_at FROM discount_codes WHERE code = ?')
    .bind(code)
    .first<{ email: string; percent: number; used_at: Date | null }>();

  if (!row || row.used_at) return null;
  if (row.email.toLowerCase() !== email) return null;
  return { code, percent: row.percent };
}

/**
 * Burns a code at payment completion. Idempotent (WHERE used_at IS NULL) so a
 * Stripe webhook retry can never double-consume, and always consumes even when
 * the purchaser's Stripe email differs from the capturing one — the charge
 * already happened; a mismatch is logged rather than left re-usable.
 */
export async function consumeCode(
  rawCode: unknown,
  sessionId: string,
  purchaserEmail?: string | null
): Promise<boolean> {
  const code = cleanCode(rawCode);
  if (!code) return false;

  const db = getDb();
  const row = await db
    .prepare('SELECT email FROM discount_codes WHERE code = ?')
    .bind(code)
    .first<{ email: string }>();

  const result = await db
    .prepare(
      'UPDATE discount_codes SET used_at = NOW(), used_session_id = ? WHERE code = ? AND used_at IS NULL'
    )
    .bind(sessionId, code)
    .run();

  if (result.meta.changes > 0) {
    const purchased = purchaserEmail?.trim().toLowerCase();
    if (row && purchased && row.email.toLowerCase() !== purchased) {
      console.error(
        `[discount] purchaser email ${purchased} does not match capturing email ${row.email} for ${code}`
      );
    }
    return true;
  }
  return false;
}
