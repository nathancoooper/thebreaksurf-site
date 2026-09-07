import { getDb } from './db';
import type { AuthenticatorTransportFuture, WebAuthnCredential } from '@simplewebauthn/server';

export interface StoredPasskey {
  id: string;
  userId: string;
  name: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  createdAt: string;
  lastUsedAt?: string;
}

export async function listPasskeysForUser(userId: string) {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM passkeys WHERE user_id = ?')
    .bind(userId)
    .all<{ data: string }>();
  return rows.results.map((r: { data: string }) => JSON.parse(r.data) as StoredPasskey);
}

export async function findPasskey(id: string) {
  const db = getDb();
  const row = await db.prepare('SELECT data FROM passkeys WHERE id = ?')
    .bind(id)
    .first<{ data: string }>();
  return row ? JSON.parse(row.data) as StoredPasskey : null;
}

export async function addPasskey(item: StoredPasskey) {
  const db = getDb();
  await db.prepare(
    'INSERT INTO passkeys (id, user_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = ?, updated_at = datetime(\'now\')'
  )
    .bind(item.id, item.userId, JSON.stringify(item), JSON.stringify(item))
    .run();
}

export async function updatePasskeyUsage(id: string, counter: number) {
  const passkey = await findPasskey(id);
  if (!passkey) return;
  passkey.counter = counter;
  passkey.lastUsedAt = new Date().toISOString();
  const db = getDb();
  await db.prepare('UPDATE passkeys SET data = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(JSON.stringify(passkey), id)
    .run();
}

export async function deletePasskey(userId: string, id: string) {
  const db = getDb();
  await db.prepare('DELETE FROM passkeys WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
}

export function storedPasskeyCredential(passkey: StoredPasskey): WebAuthnCredential {
  return {
    id: passkey.id,
    publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
    counter: passkey.counter,
    transports: passkey.transports,
  };
}

export function passkeyRelyingParty(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const production = process.env.NODE_ENV === 'production'
    || hostname === 'thebreaksurf.co.uk'
    || hostname.endsWith('.thebreaksurf.co.uk');
  return {
    rpID: production ? 'thebreaksurf.co.uk' : hostname,
    expectedOrigin: production
      ? [
          'https://admin.thebreaksurf.co.uk',
          'https://finance.thebreaksurf.co.uk',
          'https://emails.thebreaksurf.co.uk',
          'https://thebreaksurf.co.uk',
        ]
      : new URL(request.url).origin,
  };
}
