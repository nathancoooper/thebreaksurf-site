import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readDataByKey, writeData } from '@/lib/dataCache';
import type { OrderRecord, OrderStatus } from '@/lib/orders';
import { fetchOrderDetails, firstName } from '@/lib/orders';
import { sendDispatchNotification } from '@/lib/resend';

const INPOST_TRACKING_URL = 'https://inpost.co.uk/tracking';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const { status, trackingNumber } = await req.json() as { status: OrderStatus; trackingNumber?: string };
  const prev = await readDataByKey<OrderRecord>('orders', id);

  if (status === 'sent' && !trackingNumber && !prev?.trackingNumber) {
    return NextResponse.json({ error: 'An InPost tracking number is required before marking an order as Sent.' }, { status: 400 });
  }

  const record: OrderRecord & { id: string } = {
    id,
    status,
    ...(prev ?? {}),
    ...(trackingNumber ? { trackingNumber } : {}),
  };

  if (status === 'sent' && !prev?.sentAt) {
    record.sentAt = new Date().toISOString();
    try {
      const order = await fetchOrderDetails(id);
      if (order) {
        await sendDispatchNotification({
          to: order.customerEmail,
          customerName: firstName(order.customerName),
          orderReference: order.orderReference,
          trackingNumber: trackingNumber || undefined,
          trackingUrl: trackingNumber ? INPOST_TRACKING_URL : undefined,
          carrier: trackingNumber ? 'InPost' : undefined,
        });
      }
    } catch (err) {
      console.error('Failed to send dispatch notification:', err);
    }
  }

  await writeData('orders', record);
  return NextResponse.json({ ok: true });
}
