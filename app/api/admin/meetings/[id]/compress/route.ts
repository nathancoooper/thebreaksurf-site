import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  return NextResponse.json({ error: 'Video compression is not available on Cloudflare Workers.' }, { status: 501 });
}
