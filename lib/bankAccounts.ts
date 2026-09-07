// The ERPNext Bank Account doctype name (not the ledger account) for each
// merchant/clearing account — shared between client and server code so
// there's exactly one string that means "Stripe Merchant".
export const STRIPE_MERCHANT_BANK_ACCOUNT = 'Stripe Merchant - Stripe';
export const REVOLUT_MERCHANT_BANK_ACCOUNT = 'Revolut Merchant - Revolut';
