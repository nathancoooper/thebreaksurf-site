import { erpList } from './erpnext';

// ERPNext's Stock Ledger Entry keeps a running balance per (item, warehouse)
// on every entry — the balance "as of" any date is just the most recent
// entry's qty_after_transaction on or before that date, no manual summing
// required.
export async function stockBalanceAsOf(itemCode: string, warehouse: string, date: string): Promise<number> {
  const entries = await erpList<{ qty_after_transaction: number }>('Stock Ledger Entry', {
    fields: ['qty_after_transaction'],
    filters: [
      ['item_code', '=', itemCode],
      ['warehouse', '=', warehouse],
      ['posting_date', '<=', date],
      ['is_cancelled', '=', 0],
    ],
    orderBy: 'posting_date desc, posting_time desc, creation desc',
    limit: 1,
  });
  return entries[0]?.qty_after_transaction ?? 0;
}
