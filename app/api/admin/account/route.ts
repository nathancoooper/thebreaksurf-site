import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { getSessionUser } from '@/lib/adminAuth';
import { getUserByEmail, updateUser } from '@/lib/auth';
import { generateSecret, keyuri, verify as verifyTotp } from '@/lib/totp';

function publicProfile(user: { id: string; name: string; email: string; role: string; createdAt: string }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  return NextResponse.json({ account: publicProfile(user) });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await request.json() as {
    action?: string;
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
    secret?: string;
    code?: string;
  };

  if (body.action === 'profile') {
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: 'That email is already used by another account' }, { status: 409 });
    }

    const updated = await updateUser(user.id, { name, email });
    return NextResponse.json({ account: updated ? publicProfile(updated) : null });
  }

  if (body.action === 'password') {
    if (!body.currentPassword || !await bcrypt.compare(body.currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    if (!body.newPassword || body.newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }
    if (body.currentPassword === body.newPassword) {
      return NextResponse.json({ error: 'Choose a different password' }, { status: 400 });
    }

    await updateUser(user.id, { passwordHash: await bcrypt.hash(body.newPassword, 12) });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'beginTotpReset') {
    if (!body.currentPassword || !await bcrypt.compare(body.currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    const secret = generateSecret();
    const qrDataUrl = await QRCode.toDataURL(keyuri(user.email, 'TBS Admin', secret));
    return NextResponse.json({ secret, qrDataUrl });
  }

  if (body.action === 'confirmTotpReset') {
    if (!body.currentPassword || !await bcrypt.compare(body.currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    if (!body.secret || !body.code || !verifyTotp(body.code, body.secret)) {
      return NextResponse.json({ error: 'The verification code is incorrect' }, { status: 400 });
    }

    await updateUser(user.id, { totpSecret: body.secret });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown account action' }, { status: 400 });
}
