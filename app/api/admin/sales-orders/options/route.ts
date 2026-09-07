import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList } from '@/lib/erpnext';

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const [customers, items, warehouses, incomeAccounts, chargeAccounts, banks, modesOfPayment] = await Promise.all([
    erpList<{ name: string; customer_name: string }>('Customer', {
      fields: ['name', 'customer_name'],
      orderBy: 'customer_name asc',
      limit: 100,
    }),
    erpList<{ name: string; item_code: string; item_name: string; stock_uom: string; brand: string | null; variant_of: string | null; item_group: string }>('Item', {
      fields: ['name', 'item_code', 'item_name', 'stock_uom', 'brand', 'variant_of', 'item_group'],
      filters: [['item_group', 'in', ['Products', 'Services']], ['is_sales_item', '=', 1], ['has_variants', '=', 0]],
      orderBy: 'item_name asc',
      limit: 200,
    }),
    erpList<{ name: string; warehouse_name: string }>('Warehouse', {
      fields: ['name', 'warehouse_name'],
      filters: [['is_group', '=', 0]],
      orderBy: 'warehouse_name asc',
      limit: 50,
    }),
    erpList<{ name: string; account_name: string }>('Account', {
      fields: ['name', 'account_name'],
      filters: [['root_type', '=', 'Income'], ['is_group', '=', 0]],
      orderBy: 'account_name asc',
      limit: 50,
    }),
    erpList<{ name: string; account_name: string }>('Account', {
      fields: ['name', 'account_name'],
      filters: [['account_type', 'in', ['Tax', 'Chargeable']], ['is_group', '=', 0]],
      orderBy: 'account_name asc',
      limit: 50,
    }),
    erpList<{ name: string; account_name: string; account: string }>('Bank Account', {
      fields: ['name', 'account_name', 'account'],
      limit: 50,
    }),
    erpList<{ name: string }>('Mode of Payment', {
      fields: ['name'],
      orderBy: 'name asc',
      limit: 50,
    }),
  ]);

  const accounts = [...incomeAccounts];
  for (const account of chargeAccounts) {
    if (!accounts.some(existing => existing.name === account.name)) accounts.push(account);
  }

  return NextResponse.json({
    customers,
    items,
    warehouses,
    incomeAccounts,
    chargeAccounts: accounts,
    banks,
    modesOfPayment: modesOfPayment.map(mode => mode.name),
  });
}
