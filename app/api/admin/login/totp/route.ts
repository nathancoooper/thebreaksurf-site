import { NextRequest, NextResponse } from 'next/server';
import { verify as verifyTotp } from '@/lib/totp';
import { verifySession, getUserById, signSession, SESSION_COOKIE, setSessionCookie } from '@/lib/auth';
import { recordLoginAttempt } from '@/lib/loginAudit';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No session' }, { status: 401 });

  let payload;
  try {
    payload = await verifySession(token);
  } catch {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  if (!payload.pending2FA) {
    return NextResponse.json({ error: 'Already authenticated' }, { status: 400 });
  }

  const { code } = await request.json();
  const user = payload.sub ? await getUserById(payload.sub) : null;
  if (!user) return NextResponse.json({ error: 'No account' }, { status: 401 });

  if (!verifyTotp(code, user.totpSecret)) {
    await recordLoginAttempt(request, {
      userId: user.id,
      email: user.email,
      outcome: 'failed_2fa',
    }).catch(error => console.error('[login audit] failed:', error));
    return NextResponse.json({ error: 'Incorrect code' }, { status: 401 });
  }

  await recordLoginAttempt(request, {
    userId: user.id,
    email: user.email,
    outcome: 'success',
  }).catch(error => console.error('[login audit] failed:', error));

  const fullToken = await signSession({ sub: user.id }, '7d');
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, fullToken, 60 * 60 * 24 * 7);
  return response;
}
