import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpGet } from '@/lib/erpnext';

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;
  const order = await erpGet('Purchase Order', name);
  return NextResponse.json(order);
}
