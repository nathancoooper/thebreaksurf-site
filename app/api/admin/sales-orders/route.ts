import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpCreate, erpGet, erpList, erpSubmit, erpUpdate } from '@/lib/erpnext';
import {
  appendPaymentLinkTerms,
  createSalesOrderPaymentLink,
  deactivateSalesOrderPaymentLink,
  type SalesOrderPaymentLink,
} from '@/lib/salesOrderStripe';

interface SalesOrderItem {
  item_code: string;
  qty: number;
  rate: number;
  warehouse: string;
  income_account: string;
}

interface ChargeRow {
  charge_type: 'On Net Total' | 'Actual';
  account_head: string;
  description: string;
  rate?: number;
  tax_amount?: number;
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { searchParams } = new URL(req.url);
  const start = Math.max(0, parseInt(searchParams.get('start') ?? '0', 10) || 0);

  const orders = await erpList('Sales Order', {
    fields: ['name', 'customer', 'customer_name', 'transaction_date', 'delivery_date', 'grand_total', 'status', 'docstatus', 'per_billed'],
    orderBy: 'transaction_date desc, creation desc',
    limit: 50,
    start,
  });

  return NextResponse.json({ orders, hasMore: orders.length === 50 });
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();

  if (!body.customer || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'customer and at least one item are required' }, { status: 400 });
  }

  const items = (body.items as SalesOrderItem[]).filter(item =>
    item.item_code && Number.isFinite(item.qty) && item.qty > 0 && Number.isFinite(item.rate) && item.rate >= 0,
  );
  if (items.length === 0) {
    return NextResponse.json({ error: 'at least one valid item is required' }, { status: 400 });
  }

  let order: { name: string };
  try {
    order = await erpCreate<{ name: string }>('Sales Order', {
      doctype: 'Sales Order',
      company: 'The Break Surf',
      customer: body.customer,
      transaction_date: body.transaction_date,
      delivery_date: body.delivery_date,
      disable_rounded_total: 1,
      ignore_pricing_rule: 1,
      po_no: typeof body.customer_reference === 'string' ? body.customer_reference.trim() || undefined : undefined,
      items: items.map(item => ({
        item_code: item.item_code,
        qty: item.qty,
        rate: item.rate,
        price_list_rate: item.rate,
        warehouse: item.warehouse,
        income_account: item.income_account,
        delivery_date: body.delivery_date,
      })),
      taxes: ((body.taxes ?? []) as ChargeRow[]).map(tax => ({
        charge_type: tax.charge_type,
        account_head: tax.account_head,
        description: tax.description,
        rate: tax.rate ?? 0,
        tax_amount: tax.tax_amount ?? 0,
      })),
    });
  } catch (error) {
    console.error('Failed to create sales order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ERPNext rejected this sales order.' },
      { status: 502 },
    );
  }

  let stripePaymentLink: SalesOrderPaymentLink | null = null;
  if (body.create_stripe_payment_link === true) {
    try {
      const createdOrder = await erpGet<{
        customer_name?: string;
        grand_total: number;
        terms?: string | null;
      }>('Sales Order', order.name);
      stripePaymentLink = await createSalesOrderPaymentLink(
        order.name,
        createdOrder.customer_name ?? body.customer,
        Number(createdOrder.grand_total),
      );
      await erpUpdate('Sales Order', order.name, {
        terms: appendPaymentLinkTerms(createdOrder.terms, stripePaymentLink),
      });
    } catch (error) {
      if (stripePaymentLink) {
        await deactivateSalesOrderPaymentLink(
          `<!-- stripe-payment-link:${stripePaymentLink.id} -->`,
        ).catch(() => {});
      }
      console.error(`Failed to add Stripe payment link to sales order ${order.name}:`, error);
      return NextResponse.json(
        {
          error: `${order.name} was created as a draft, but its Stripe payment link could not be added. ${
            error instanceof Error ? error.message : 'Stripe rejected the payment link.'
          }`,
        },
        { status: 502 },
      );
    }
  }

  try {
    await erpSubmit('Sales Order', order.name);
  } catch (error) {
    if (stripePaymentLink) {
      await deactivateSalesOrderPaymentLink(
        `<!-- stripe-payment-link:${stripePaymentLink.id} -->`,
      ).catch(() => {});
    }
    console.error(`Failed to submit sales order ${order.name}:`, error);
    return NextResponse.json(
      { error: `${order.name} was created but failed to submit. It is still a draft in ERPNext and has not been treated as an active order.` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ...order,
    stripe_payment_url: stripePaymentLink?.url ?? null,
  });
}
