import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpCreate, erpGet, erpList, erpSubmit } from '@/lib/erpnext';
import { deactivateSalesOrderPaymentLink } from '@/lib/salesOrderStripe';

interface SalesOrderItem {
  name: string;
  item_code: string;
  item_name: string;
  description: string;
  qty: number;
  rate: number;
  uom: string;
  warehouse: string;
  income_account: string;
}

interface SalesOrderTax {
  charge_type: string;
  account_head: string;
  description: string;
  rate: number;
  tax_amount: number;
}

interface SalesOrder {
  name: string;
  customer: string;
  docstatus: number;
  per_billed: number;
  grand_total: number;
  terms?: string | null;
  items: SalesOrderItem[];
  taxes: SalesOrderTax[];
}

interface DraftInvoice {
  name: string;
  items: { sales_order?: string | null }[];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;
  const body = await req.json();
  const order = await erpGet<SalesOrder>('Sales Order', name);

  if (order.docstatus !== 1) {
    return NextResponse.json({ error: order.docstatus === 2 ? 'Cancelled sales orders cannot be invoiced.' : 'Submit this sales order before marking it paid.' }, { status: 409 });
  }
  if ((order.per_billed ?? 0) > 0) {
    return NextResponse.json({ error: 'This sales order already has billed items.' }, { status: 409 });
  }
  if (!body.mode_of_payment) {
    return NextResponse.json({ error: 'mode of payment is required' }, { status: 400 });
  }

  // A failed request may have created a draft invoice before submission
  // failed. The integration user cannot list child doctypes directly, so
  // inspect the small set of recent draft parent invoices instead. Submitted
  // invoices are already caught by per_billed above.
  const draftRows = await erpList<{ name: string }>('Sales Invoice', {
    fields: ['name'],
    filters: [['docstatus', '=', 0]],
    orderBy: 'creation desc',
    limit: 100,
  });
  const draftInvoices = await Promise.all(draftRows.map(row => erpGet<DraftInvoice>('Sales Invoice', row.name)));
  const existingInvoices = draftInvoices.filter(invoice => invoice.items?.some(item => item.sales_order === name));
  if (existingInvoices.length > 0) {
    const invoiceNames = existingInvoices.map(invoice => invoice.name);
    return NextResponse.json(
      { error: `A Sales Invoice already exists for this order (${invoiceNames.join(', ')}). Check it in ERPNext before retrying.` },
      { status: 409 },
    );
  }

  // A bank transfer/manual payment makes the card link invalid. Disable it
  // before recording the sale so the customer cannot accidentally pay twice.
  try {
    await deactivateSalesOrderPaymentLink(order.terms);
  } catch (error) {
    console.error(`Failed to deactivate Stripe payment link for ${name}:`, error);
    return NextResponse.json(
      { error: 'The Stripe payment link could not be disabled, so this order was not marked paid. Retry before recording the payment to avoid a duplicate charge.' },
      { status: 502 },
    );
  }

  const postingDate = typeof body.posting_date === 'string' && body.posting_date ? body.posting_date : new Date().toISOString().slice(0, 10);
  const paidAmount = Number(order.grand_total);

  let invoice: { name: string };
  try {
    invoice = await erpCreate<{ name: string }>('Sales Invoice', {
      doctype: 'Sales Invoice',
      company: 'The Break Surf',
      customer: order.customer,
      posting_date: postingDate,
      is_pos: 1,
      update_stock: 1,
      disable_rounded_total: 1,
      ignore_pricing_rule: 1,
      items: order.items.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        description: item.description,
        qty: item.qty,
        rate: item.rate,
        price_list_rate: item.rate,
        uom: item.uom,
        warehouse: item.warehouse,
        income_account: item.income_account,
        sales_order: order.name,
        so_detail: item.name,
      })),
      taxes: (order.taxes ?? []).map(tax => ({
        charge_type: tax.charge_type,
        account_head: tax.account_head,
        description: tax.description,
        rate: tax.rate,
        tax_amount: tax.tax_amount,
      })),
      payments: [{
        mode_of_payment: body.mode_of_payment,
        account: body.cash_bank_account || undefined,
        amount: paidAmount,
      }],
    });
  } catch (error) {
    console.error(`Failed to create invoice from sales order ${name}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ERPNext rejected the Sales Invoice.' },
      { status: 502 },
    );
  }

  try {
    await erpSubmit('Sales Invoice', invoice.name);
  } catch (error) {
    console.error(`Failed to submit sales invoice ${invoice.name} from ${name}:`, error);
    return NextResponse.json(
      { error: `${invoice.name} was created but failed to submit. It remains a draft in ERPNext; inspect it before retrying.` },
      { status: 502 },
    );
  }

  return NextResponse.json({ order: name, invoice: invoice.name, paidAmount });
}
