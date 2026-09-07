import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/adminAuth';
import { SESSION_COOKIE, setSessionCookie } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const response = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  });
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && process.env.NODE_ENV === 'production') {
    setSessionCookie(response, token, 60 * 60 * 24 * 7);
  }
  return response;
}
