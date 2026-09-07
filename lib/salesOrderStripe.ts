import { stripe } from '@/lib/stripe';

const PAYMENT_LINK_ID_MARKER = /<!--\s*stripe-payment-link:([A-Za-z0-9_]+)\s*-->/;
const PAYMENT_LINK_URL_MARKER = /<!--\s*stripe-payment-url:(https:\/\/[^<\s]+)\s*-->/;

export interface SalesOrderPaymentLink {
  id: string;
  url: string;
}

export async function createSalesOrderPaymentLink(
  salesOrder: string,
  customerName: string,
  grandTotal: number,
): Promise<SalesOrderPaymentLink> {
  const unitAmount = Math.round(grandTotal * 100);
  if (!Number.isSafeInteger(unitAmount) || unitAmount < 50) {
    throw new Error('Stripe payment links require an order total of at least £0.50.');
  }

  const metadata = {
    flow: 'sales_order',
    sales_order: salesOrder,
  };
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{
      price_data: {
        currency: 'gbp',
        unit_amount: unitAmount,
        product_data: {
          name: `Sales Order ${salesOrder}`,
          description: customerName ? `The Break Surf — ${customerName}` : 'The Break Surf Sales Order',
        },
      },
      quantity: 1,
    }],
    metadata,
    payment_intent_data: {
      description: `The Break Surf Sales Order ${salesOrder}`,
      metadata,
    },
    payment_method_types: ['card'],
    restrictions: {
      completed_sessions: { limit: 1 },
    },
    submit_type: 'pay',
    after_completion: {
      type: 'hosted_confirmation',
      hosted_confirmation: {
        custom_message: `Thank you. Payment for ${salesOrder} has been received.`,
      },
    },
  });

  return { id: paymentLink.id, url: paymentLink.url };
}

export function appendPaymentLinkTerms(
  existingTerms: string | null | undefined,
  paymentLink: SalesOrderPaymentLink,
): string {
  const existing = existingTerms?.trim();
  const cardPayment = [
    `<!-- stripe-payment-section:start -->`,
    `<p><strong>Pay securely by card</strong><br>`,
    `Alternatively, pay this Sales Order by card using Stripe: `,
    `<a href="${paymentLink.url}">${paymentLink.url}</a></p>`,
    `<!-- stripe-payment-link:${paymentLink.id} -->`,
    `<!-- stripe-payment-url:${paymentLink.url} -->`,
    `<!-- stripe-payment-section:end -->`,
  ].join('');
  return existing ? `${existing}\n${cardPayment}` : cardPayment;
}

export function paymentLinkIdFromTerms(terms: string | null | undefined): string | null {
  return terms?.match(PAYMENT_LINK_ID_MARKER)?.[1] ?? null;
}

export function paymentLinkUrlFromTerms(terms: string | null | undefined): string | null {
  return terms?.match(PAYMENT_LINK_URL_MARKER)?.[1] ?? null;
}

export async function deactivateSalesOrderPaymentLink(terms: string | null | undefined) {
  const paymentLinkId = paymentLinkIdFromTerms(terms);
  if (paymentLinkId) {
    await stripe.paymentLinks.update(paymentLinkId, { active: false });
  }
}
