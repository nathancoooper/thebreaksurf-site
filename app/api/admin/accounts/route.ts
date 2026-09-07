import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList } from '@/lib/erpnext';

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const [bankAccounts, expenses, directors] = await Promise.all([
    // Account.account_type = 'Bank' misses every merchant/clearing account
    // (Stripe/SumUp/Revolut Merchant have no account_type set at all) — the
    // Bank Account doctype is the same source of truth the rest of the admin
    // panel already uses, so this is guaranteed to include all six.
    erpList<{ name: string; account_name: string; account: string }>('Bank Account', {
      fields: ['name', 'account_name', 'account'],
      limit: 20,
    }),
    erpList<{ name: string; account_name: string }>('Account', {
      fields: ['name', 'account_name'],
      filters: [['root_type', '=', 'Expense'], ['is_group', '=', 0]],
      orderBy: 'name asc',
      limit: 100,
    }),
    erpList<{ name: string; account_name: string }>('Account', {
      fields: ['name', 'account_name'],
      filters: [['account_name', 'like', '%Directors Loan%']],
      orderBy: 'account_name asc',
      limit: 10,
    }),
  ]);

  // Ledger account (not the Bank Account doctype name) is what Journal
  // Entry Account rows actually need — same shape as before this fix.
  const banks = bankAccounts.map(b => ({ name: b.account, account_name: b.account_name }));

  return NextResponse.json({ banks, expenses, directors });
}
