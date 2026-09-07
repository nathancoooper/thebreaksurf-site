import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { generateSecret, keyuri } from '@/lib/totp';
import QRCode from 'qrcode';
import { listUsers, createUser, signSession, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const existing = await listUsers();
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
  }

  const { name, email, password } = await request.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const totpSecret = generateSecret();
  // First account ever created is always the owner — full access, and the
  // only one who can manage the Team page.
  await createUser({
    id: 'owner',
    name,
    email,
    passwordHash,
    totpSecret,
    role: 'owner',
    permissions: [],
    createdAt: new Date().toISOString(),
  });

  const uri = keyuri('admin', 'TBS Admin', totpSecret);
  const qrDataUrl = await QRCode.toDataURL(uri);

  const pendingToken = await signSession({ sub: 'owner', pending2FA: true }, '10m');
  const response = NextResponse.json({ qrDataUrl, totpSecret });
  setSessionCookie(response, pendingToken, 60 * 10);
  return response;
}
