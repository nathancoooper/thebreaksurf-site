import Stripe from 'stripe';
import { stripe } from './stripe';

export type OrderStatus = 'placed' | 'sent' | 'delivered';

// Persisted per-order lifecycle state (data/orders.json), keyed by Stripe
// checkout session id. sentAt/reviewEmailSentAt double as idempotency guards
// so the dispatch and 14-days-later review emails only ever go out once.
export interface OrderRecord {
  status: OrderStatus;
  sentAt?: string;
  reviewEmailSentAt?: string;
  trackingNumber?: string;
}

export function shortRef(sessionId: string) {
  // cs_test_abc123... → TBS-ABC123 (last 8 chars, uppercase)
  return 'TBS-' + sessionId.slice(-8).toUpperCase();
}

// data/orders.json used to store a plain status string per order before
// sentAt/reviewEmailSentAt were added. Normalises either shape into the
// current OrderRecord form so old entries don't get corrupted by naively
// spreading a string ({...prev} on a string spreads its characters, not its
// properties).
export function normalizeOrderRecord(raw: OrderRecord | OrderStatus | undefined): OrderRecord | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') return { status: raw };
  return raw;
}

export function normalizeOrdersFile(raw: Record<string, OrderRecord | OrderStatus>): Record<string, OrderRecord> {
  const normalized: Record<string, OrderRecord> = {};
  for (const [id, value] of Object.entries(raw)) {
    const record = normalizeOrderRecord(value);
    if (record) normalized[id] = record;
  }
  return normalized;
}

export function firstName(name: string) {
  return name.split(' ')[0] || name;
}

export interface OrderItemDetail {
  name: string;
  description?: string;
  quantity: number;
  unitAmount: number;
  imageUrl?: string | null;
}

export interface OrderDetails {
  id: string;
  customerName: string;
  customerEmail: string;
  orderReference: string;
  items: OrderItemDetail[];
  subtotal: number;
  shippingAmount: number;
  total: number;
  currency: string;
}

// Fetches a completed checkout session and normalises it into the shape the
// order-lifecycle emails need. Returns null if the session isn't a completed
// order or has no customer email to send to.
export async function fetchOrderDetails(sessionId: string): Promise<OrderDetails | null> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price.product'],
  });

  if (session.status !== 'complete') return null;
  const email = session.customer_details?.email;
  if (!email) return null;

  const items: OrderItemDetail[] = (session.line_items?.data ?? []).map(li => {
    const price = li.price;
    const product = price && typeof price !== 'string' && typeof price.product !== 'string'
      ? price.product as Stripe.Product
      : null;
    return {
      name: product?.name ?? li.description ?? 'Item',
      description: product?.description ?? undefined,
      quantity: li.quantity ?? 1,
      unitAmount: price && typeof price !== 'string' ? price.unit_amount ?? 0 : 0,
      imageUrl: product?.images?.[0] ?? null,
    };
  });

  const shippingAmount = (session as unknown as { shipping_cost?: { amount_total?: number } }).shipping_cost?.amount_total ?? 0;
  const total = session.amount_total ?? 0;

  return {
    id: session.id,
    customerName: session.customer_details?.name ?? 'there',
    customerEmail: email,
    orderReference: shortRef(session.id),
    items,
    subtotal: total - shippingAmount,
    shippingAmount,
    total,
    currency: session.currency ?? 'gbp',
  };
}
