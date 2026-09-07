import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getResend, FROM_EMAIL, REPLY_TO, sendOrderConfirmation, newOrderAlertHtml } from '@/lib/resend';
import { getDb } from '@/lib/db';

type StripeEvent = import('stripe').default.Event;
type StripeCheckoutSession = import('stripe').default.Checkout.Session;

const ALERT_TO = 'nathanjohncooper@tuta.com';

export async function POST(req: NextRequest) {
  const stripe = await getStripe();
  const resend = await getResend();
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const stub = event.data.object as StripeCheckoutSession;
    try {
      const session = await stripe.checkout.sessions.retrieve(stub.id);
      await handleCheckoutComplete(session, resend);
    } catch (err) {
      console.error('[stripe webhook] failed for', stub.id, err);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ALERT_TO,
        subject: `TBS: order webhook failed — ${stub.id}`,
        html: `<p>Processing failed for session <code>${stub.id}</code>.</p><pre>${err instanceof Error ? err.stack : String(err)}</pre>`,
      }).catch(() => {});
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(session: StripeCheckoutSession, resend: import('resend').Resend) {
  const email = session.customer_details?.email;
  const customerName = session.customer_details?.name ?? 'there';
  if (!email) return;

  const db = getDb();
  const row = await db.prepare('SELECT data FROM pending_checkouts WHERE session_id = ?')
    .bind(session.id)
    .first<{ data: string }>();

  if (!row) {
    console.log('[webhook] no pending checkout for', session.id);
    return;
  }

  const rawItems: { n: string; c: string; s: string; q: number; p: number; img: string }[] = JSON.parse(row.data);
  const appUrl = session.metadata?.appUrl || 'https://thebreaksurf.co.uk';

  const items = rawItems.map(i => ({
    name: i.n,
    description: `${i.c} / ${i.s}`,
    quantity: i.q,
    unitAmount: i.p,
    imageUrl: i.img ? `${appUrl}${i.img}` : null,
  }));

  const shippingAddress = (session as any).shipping_details?.address ?? session.customer_details?.address;
  const shippingCost = (session as any).shipping_cost?.amount_total ?? 0;

  const [customerResult, adminResult] = await Promise.allSettled([
    sendOrderConfirmation({
      to: email,
      customerName: customerName.split(' ')[0],
      orderReference: session.id.slice(-8).toUpperCase(),
      items,
      subtotal: (session.amount_total ?? 0) - shippingCost,
      shippingAmount: shippingCost,
      total: session.amount_total ?? 0,
      shippingAddress: {
        line1: shippingAddress?.line1 ?? '',
        line2: shippingAddress?.line2,
        city: shippingAddress?.city ?? '',
        postalCode: shippingAddress?.postal_code ?? '',
        country: shippingAddress?.country ?? 'GB',
      },
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: REPLY_TO,
      subject: `New order — ${session.id.slice(-8).toUpperCase()} — £${((session.amount_total ?? 0) / 100).toFixed(2)}`,
      html: newOrderAlertHtml({
        orderReference: session.id.slice(-8).toUpperCase(),
        customerName,
        customerEmail: email,
        total: session.amount_total ?? 0,
        items,
        shippingAddressLine: [shippingAddress?.line1, shippingAddress?.line2, shippingAddress?.city, shippingAddress?.postal_code].filter(Boolean).join(', '),
      }),
    }),
  ]);

  if (customerResult.status === 'rejected') {
    console.error('[webhook] customer email failed:', customerResult.reason);
  }
  if (adminResult.status === 'rejected') {
    console.error('[webhook] admin email failed:', adminResult.reason);
  }

  if (customerResult.status === 'fulfilled' && adminResult.status === 'fulfilled') {
    await db.prepare('DELETE FROM pending_checkouts WHERE session_id = ?')
      .bind(session.id)
      .run();
  }
}
