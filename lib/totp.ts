const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32Encode(buf: Uint8Array): string {
  let out = '', bits = 0, val = 0;
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHA[(val >> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHA[(val << (5 - bits)) & 31];
  return out;
}

function b32Decode(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '').toUpperCase();
  let bits = 0, val = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const i = ALPHA.indexOf(ch);
    if (i === -1) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { bytes.push((val >> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(bytes);
}

export function generateSecret(bytes = 20): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b32Encode(buf);
}

export function keyuri(account: string, issuer: string, secret: string): string {
  const p = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${p}`;
}

async function hotp(secret: string, counter: bigint): Promise<string> {
  const key = b32Decode(secret);
  const msg = new Uint8Array(8);
  const view = new DataView(msg.buffer);
  view.setBigUint64(0, counter);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msg));
  const off = mac[mac.length - 1] & 0xf;
  const code = ((mac[off] << 24 | mac[off + 1] << 16 | mac[off + 2] << 8 | mac[off + 3]) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

export async function verify(token: string, secret: string, window = 1): Promise<boolean> {
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (await hotp(secret, BigInt(step + i)) === token) return true;
  }
  return false;
}
