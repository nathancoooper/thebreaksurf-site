import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { CartItem } from '@/types';
import { getDiscountPercent, applyDiscount } from '@/lib/promotions';
import { getAvailability, variantItemCode } from '@/lib/stock';
import { getDb } from '@/lib/db';

const FREE_SHIPPING_THRESHOLD = 5000; // £50, in pence — see app/shipping/page.tsx

export async function POST(req: NextRequest) {
  try {
    const { items }: { items: CartItem[] } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items in cart' }, { status: 400 });
    }

    // Stock is re-checked here, never trusting whatever the product page
    // showed when the item was added to the cart — the authoritative check
    // happens right before payment, same reasoning as recomputing discounts
    // below. Products with no erpItemPrefix set aren't stock-tracked and are
    // always purchasable.
    const soldOut: { name: string; color: string; size: string }[] = [];
    for (const item of items) {
      const available = await getAvailability(item.product, item.color, item.size);
      if (available !== null && available < item.quantity) {
        soldOut.push({ name: item.product.name, color: item.color, size: item.size });
      }
    }
    if (soldOut.length > 0) {
      const label = soldOut
        .map(s => `${s.name}${[s.color, s.size].filter(Boolean).length ? ` (${[s.color, s.size].filter(Boolean).join(' / ')})` : ''}`)
        .join(', ');
      return NextResponse.json(
        { error: `Sorry, ${label} just sold out.`, soldOut },
        { status: 409 }
      );
    }

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Resolve line items — fetch amount from Stripe when a Price ID is set,
    // but always build price_data inline so the correct variant image is passed.
    // Discount is always recomputed here from live promotion data — never
    // trust a discounted price sent by the client.
    const line_items = await Promise.all(items.map(async item => {
      const variantImage = item.product.images.colors?.[item.color]?.cover ?? item.product.images.cover;
      const imageUrl = `${appUrl}${variantImage}`;

      let unitAmount = item.product.price;
      let currency = 'gbp';

      if (item.product.stripePriceId) {
        const stripePrice = await (await getStripe()).prices.retrieve(item.product.stripePriceId);
        unitAmount = stripePrice.unit_amount ?? item.product.price;
        currency = stripePrice.currency;
      }

      const discountPercent = await getDiscountPercent(item.product.id);
      if (discountPercent > 0) unitAmount = applyDiscount(unitAmount, discountPercent);

      return {
        price_data: {
          currency,
          product_data: {
            name: item.product.name,
            description: [item.color, item.size].filter(Boolean).join(' / ') || undefined,
            images: [imageUrl],
          },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      };
    }));

    // Item data for the order confirmation email (written to disk below,
    // keyed by session id) — uses the actual charged (post-discount) amount
    // from line_items. itemCode is resolved here (while we still have the
    // live Product object) so the webhook can record the sale against the
    // day's stock snapshot without needing to re-look-up product data later.
    const emailItems = items.map((item, i) => ({
      n: item.product.name,
      c: item.color,
      s: item.size,
      q: item.quantity,
      p: line_items[i].price_data.unit_amount,
      img: item.product.images.colors?.[item.color]?.cover ?? item.product.images.cover,
      itemCode: variantItemCode(item.product, item.color, item.size),
    }));

    const subtotal = line_items.reduce((sum, li) => sum + li.price_data.unit_amount * li.quantity, 0);
    const standardShippingAmount = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 250;

    const session = await (await getStripe()).checkout.sessions.create({
      payment_method_types: ['card'],
      metadata: {
        appUrl,
      },
      line_items,
      mode: 'payment',
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cancel`,
      shipping_address_collection: {
        allowed_countries: ['GB', 'IE', 'US', 'CA', 'AU', 'NZ', 'FR', 'DE', 'NL'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: standardShippingAmount, currency: 'gbp' },
            display_name: 'Standard delivery',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 5 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'gbp' },
            display_name: 'AUB Campus Pickup',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 1 },
              maximum: { unit: 'business_day', value: 3 },
            },
          },
        },
      ],
    });

    // Item details (name, image, price) for the order confirmation email are
    // written here instead of Stripe session metadata — metadata values are
    // capped at 500 characters each, which a cart of even 3-4 different
    // products with full image paths blows straight past, failing checkout
    // outright. D1 storage has no such ceiling.
    const db = getDb();
    await db.prepare('INSERT INTO pending_checkouts (session_id, data) VALUES (?, ?)')
      .bind(session.id, JSON.stringify(emailItems))
      .run();

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
