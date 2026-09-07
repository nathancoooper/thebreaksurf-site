import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { getStripe } from '@/lib/stripe';
import { readData } from '@/lib/dataCache';
import type { OrderRecord } from '@/lib/orders';
import type Stripe from 'stripe';

async function readStatuses(): Promise<Record<string, OrderRecord>> {
  const orders = await readData<OrderRecord & { id: string }>('orders');
  const map: Record<string, OrderRecord> = {};
  for (const o of orders) {
    map[o.id] = o;
  }
  return map;
}

async function enrichLineItem(li: Stripe.LineItem) {
  const stripe = getStripe();
  let image: string | undefined;
  let variant: string | undefined;
  try {
    const priceId = typeof li.price === 'string' ? li.price : li.price?.id;
    if (priceId) {
      const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
      const product = price.product as Stripe.Product;
      image = product.images?.[0];
      variant = product.description ?? undefined;
    }
  } catch { /* non-critical */ }
  return {
    description: li.description,
    variant,
    image,
    quantity: li.quantity,
    total: li.amount_total,
    currency: li.currency,
  };
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const stripe = getStripe();
  const { searchParams } = new URL(req.url);
  const starting_after = searchParams.get('cursor') ?? undefined;

  let sessions;
  let statuses: Record<string, OrderRecord> = {};
  try {
    [sessions, statuses] = await Promise.all([
      stripe.checkout.sessions.list({ limit: 25, starting_after, expand: ['data.line_items'] }),
      readStatuses(),
    ]);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  const orders = await Promise.all(
    sessions.data
      .filter(s => s.status === 'complete')
      .map(async s => ({
        id: s.id,
        created: s.created,
        paymentStatus: s.payment_status,
        customer: {
          name: s.customer_details?.name ?? s.collected_information?.shipping_details?.name ?? '—',
          email: s.customer_details?.email ?? '—',
        },
        shipping: s.collected_information?.shipping_details?.address ?? null,
        items: await Promise.all((s.line_items?.data ?? []).map(enrichLineItem)),
        subtotal: s.amount_subtotal,
        total: s.amount_total,
        currency: s.currency,
        status: statuses[s.id]?.status ?? 'placed',
        trackingNumber: statuses[s.id]?.trackingNumber ?? null,
      }))
  );

  const data = sessions.data;
  return NextResponse.json({
    orders,
    hasMore: sessions.has_more,
    nextCursor: data.length > 0 ? data[data.length - 1].id : null,
  });
}
