import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserById, SESSION_COOKIE, type AdminAccount } from './auth';

export async function requireAdminFromRequest(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const payload = await verifySession(token);
    return !payload.pending2FA;
  } catch {
    return false;
  }
}

// Resolves the full account behind the current session — used by
// permission-aware routes (/api/admin/me, /api/admin/team/*) rather than
// the plain boolean check every other admin route already uses.
export async function getSessionUser(request: NextRequest): Promise<AdminAccount | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await verifySession(token);
    if (payload.pending2FA || !payload.sub) return null;
    return await getUserById(payload.sub);
  } catch {
    return null;
  }
}

export function unauthorised() {
  return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
}
