import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getDb } from './db';

export const SESSION_COOKIE = 'tbs-session';
// Cookie domain is configurable. Default is host-only (no Domain attribute),
// which works on *.pages.dev. If you later want the session shared across
// subdomains (e.g. after pointing admin.thebreaksurf.co.uk here), set
// COOKIE_DOMAIN=.thebreaksurf.co.uk.
function sessionCookieDomain(): string | undefined {
  return process.env.COOKIE_DOMAIN || undefined;
}

function sessionCookieHeader(value: string, maxAge: number, domain?: string): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(domain ? [`Domain=${domain}`, 'Secure'] : []),
  ].join('; ');
}

export function setSessionCookie(
  response: { headers: Headers },
  value: string,
  maxAge: number,
): void {
  const domain = sessionCookieDomain();
  if (domain) {
    response.headers.append('Set-Cookie', sessionCookieHeader('', 0));
  }
  response.headers.append('Set-Cookie', sessionCookieHeader(value, maxAge, domain));
}

export function clearSessionCookies(response: { headers: Headers }): void {
  response.headers.append('Set-Cookie', sessionCookieHeader('', 0));
  const domain = sessionCookieDomain();
  if (domain) {
    response.headers.append('Set-Cookie', sessionCookieHeader('', 0, domain));
  }
}

function secret(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error('ADMIN_JWT_SECRET is not set');
  return new TextEncoder().encode(s);
}

export async function signSession(
  payload: Record<string, unknown>,
  expiresIn: string = '7d',
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifySession(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret());
  return payload;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  totpSecret: string;
  role: 'owner' | 'member';
  permissions: string[];
  emailAddresses?: string[];
  tillPinHash?: string;
  createdAt: string;
}

export async function listUsers(): Promise<AdminAccount[]> {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM users').all<{ data: string }>();
  return rows.results.map((r: { data: string }) => JSON.parse(r.data) as AdminAccount);
}

export async function getUserById(id: string): Promise<AdminAccount | null> {
  const db = getDb();
  const row = await db.prepare('SELECT data FROM users WHERE id = ?').bind(id).first<{ data: string }>();
  return row ? JSON.parse(row.data) as AdminAccount : null;
}

export async function getUserByEmail(email: string): Promise<AdminAccount | null> {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM users').all<{ data: string }>();
  const users = rows.results.map((r: { data: string }) => JSON.parse(r.data) as AdminAccount);
  return users.find((u: AdminAccount) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function createUser(account: AdminAccount): Promise<void> {
  const db = getDb();
  await db.prepare('INSERT INTO users (id, data) VALUES (?, ?)')
    .bind(account.id, JSON.stringify(account))
    .run();
}

export async function updateUser(id: string, patch: Partial<Omit<AdminAccount, 'id'>>): Promise<AdminAccount | null> {
  const existing = await getUserById(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  const db = getDb();
  await db.prepare('UPDATE users SET data = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(JSON.stringify(updated), id)
    .run();
  return updated;
}

export async function deleteUser(id: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
}
