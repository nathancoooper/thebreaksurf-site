import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { readSetting, writeSetting } from '@/lib/dataCache';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    await verifySession(token);
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { stockCheckEnabled } = await request.json();
  await writeSetting('settings', 'stockCheckEnabled', !!stockCheckEnabled);
  return NextResponse.json({ ok: true, stockCheckEnabled: !!stockCheckEnabled });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    await verifySession(token);
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const val = await readSetting<boolean>('settings', 'stockCheckEnabled');
  return NextResponse.json({ stockCheckEnabled: val === true });
}
