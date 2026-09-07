import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  return NextResponse.json({ error: 'Full backup is not available on Cloudflare. D1 has built-in backups.' }, { status: 501 });
}

export async function POST(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  return NextResponse.json({ error: 'Full backup is not available on Cloudflare. D1 has built-in backups.' }, { status: 501 });
}
