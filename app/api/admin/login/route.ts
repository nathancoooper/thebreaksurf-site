import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { listUsers, getUserByEmail, signSession, setSessionCookie } from '@/lib/auth';
import { recordLoginAttempt } from '@/lib/loginAudit';

export async function GET() {
  const users = await listUsers();
  return NextResponse.json({ needsSetup: users.length === 0 });
}

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const user = await getUserByEmail(typeof email === 'string' ? email : '');

  if (!user) {
    await recordLoginAttempt(request, {
      email: typeof email === 'string' ? email : '',
      outcome: 'failed_password',
    }).catch(error => console.error('[login audit] failed:', error));
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  const ok = typeof password === 'string' && await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await recordLoginAttempt(request, {
      userId: user.id,
      email: user.email,
      outcome: 'failed_password',
    }).catch(error => console.error('[login audit] failed:', error));
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  const token = await signSession({ sub: user.id, pending2FA: true }, '10m');
  const response = NextResponse.json({ step: 'totp' });
  setSessionCookie(response, token, 60 * 10);
  return response;
}
