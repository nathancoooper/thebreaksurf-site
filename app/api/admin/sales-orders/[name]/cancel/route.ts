import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpCancel, erpGet } from '@/lib/erpnext';
import { deactivateSalesOrderPaymentLink } from '@/lib/salesOrderStripe';

interface SalesOrderStatus {
  name: string;
  docstatus: number;
  per_billed: number;
  terms?: string | null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;
  const order = await erpGet<SalesOrderStatus>('Sales Order', name);

  if (order.docstatus !== 1) {
    return NextResponse.json({ error: order.docstatus === 2 ? 'This sales order is already cancelled.' : 'Only submitted sales orders can be cancelled.' }, { status: 409 });
  }
  if ((order.per_billed ?? 0) > 0) {
    return NextResponse.json({ error: 'Cancel the linked Sales Invoice before cancelling this order.' }, { status: 409 });
  }

  try {
    await deactivateSalesOrderPaymentLink(order.terms);
    await erpCancel('Sales Order', name);
    return NextResponse.json({ name, docstatus: 2 });
  } catch (error) {
    console.error(`Failed to cancel sales order ${name}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ERPNext rejected the cancellation.' },
      { status: 502 },
    );
  }
}
