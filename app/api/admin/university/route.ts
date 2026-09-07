import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { listSubmissions } from '@/lib/universitySubmissions';

export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  return NextResponse.json(await listSubmissions());
}
