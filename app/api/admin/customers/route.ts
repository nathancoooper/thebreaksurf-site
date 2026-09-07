import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpCreate } from '@/lib/erpnext';

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();
  if (!body.customer_name) {
    return NextResponse.json({ error: 'customer_name is required' }, { status: 400 });
  }

  const customer = await erpCreate<{ name: string }>('Customer', {
    doctype: 'Customer',
    customer_name: body.customer_name,
    customer_type: body.customer_type ?? 'Individual',
  });

  return NextResponse.json(customer);
}
