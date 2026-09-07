import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-08-26.dahlia',
      // On Cloudflare Workers the Node `nodejs_compat` shim can make the
      // SDK pick Node's http client, which fails to reach api.stripe.com.
      // Force the fetch-based client so outbound requests use fetch().
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return _stripe;
}

// Backwards compat - lazy proxy that defers initialization
export const stripe = new Proxy({} as unknown as Stripe, {
  get(_, prop, receiver) {
    const target = getStripe();
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});