type StripeClient = import('stripe').default;

let _stripe: Promise<StripeClient> | null = null;

// Dynamic import keeps the 18MB Stripe SDK out of the worker's cold-start
// module evaluation. A top-level `import Stripe from 'stripe'` would parse and
// execute the whole package every time the isolate boots, blowing the free
// tier's ~10ms CPU budget (the origin of intermittent 503/1102s). It's only
// loaded on first use, then cached. Callers must `await getStripe()`.
export function getStripe(): Promise<StripeClient> {
  if (!_stripe) {
    _stripe = import('stripe').then(m => new m.default(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-08-26.dahlia',
    }));
  }
  return _stripe;
}