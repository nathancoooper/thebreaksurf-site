import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/adminAuth';
import { listLoginAttemptsForUser } from '@/lib/loginAudit';

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const entries = await listLoginAttemptsForUser(user.id, user.email);
  return NextResponse.json({ entries });
}
