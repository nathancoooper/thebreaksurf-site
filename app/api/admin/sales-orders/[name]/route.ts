import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpCancel, erpCreate, erpGet, erpSubmit, erpUpdate } from '@/lib/erpnext';
import {
  appendPaymentLinkTerms,
  createSalesOrderPaymentLink,
  deactivateSalesOrderPaymentLink,
  type SalesOrderPaymentLink,
} from '@/lib/salesOrderStripe';

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;
  const order = await erpGet('Sales Order', name);
  return NextResponse.json(order);
}

interface SalesOrderStatus {
  customer: string;
  docstatus: number;
  per_billed: number;
  terms?: string | null;
}

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;
  const body = await req.json();
  const original = await erpGet<SalesOrderStatus>('Sales Order', name);

  if (original.docstatus !== 1 || (original.per_billed ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Only submitted, unpaid Sales Orders can be edited.' },
      { status: 409 },
    );
  }
  if (!body.customer || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'customer and at least one item are required' }, { status: 400 });
  }

  const items = (body.items as SalesOrderItem[]).filter(item =>
    item.item_code && Number.isFinite(item.qty) && item.qty > 0 && Number.isFinite(item.rate) && item.rate >= 0,
  );
  if (items.length === 0) {
    return NextResponse.json({ error: 'at least one valid item is required' }, { status: 400 });
  }

  // ERPNext does not permit changing commercial fields on a submitted order.
  // Its supported edit path is to cancel the original and create an amended
  // replacement, preserving both documents in the audit trail.
  try {
    await deactivateSalesOrderPaymentLink(original.terms);
    await erpCancel('Sales Order', name);
  } catch (error) {
    console.error(`Failed to prepare sales order ${name} for amendment:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ERPNext could not amend this Sales Order.' },
      { status: 502 },
    );
  }

  let amended: { name: string };
  try {
    amended = await erpCreate<{ name: string }>('Sales Order', {
      doctype: 'Sales Order',
      amended_from: name,
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
    console.error(`Failed to create amendment for sales order ${name}:`, error);
    return NextResponse.json(
      { error: `${name} was cancelled, but ERPNext could not create its amended replacement. ${error instanceof Error ? error.message : ''}`.trim() },
      { status: 502 },
    );
  }

  let stripePaymentLink: SalesOrderPaymentLink | null = null;
  if (body.create_stripe_payment_link === true) {
    try {
      const amendedOrder = await erpGet<{
        customer_name?: string;
        grand_total: number;
        terms?: string | null;
      }>('Sales Order', amended.name);
      stripePaymentLink = await createSalesOrderPaymentLink(
        amended.name,
        amendedOrder.customer_name ?? body.customer,
        Number(amendedOrder.grand_total),
      );
      await erpUpdate('Sales Order', amended.name, {
        terms: appendPaymentLinkTerms(amendedOrder.terms, stripePaymentLink),
      });
    } catch (error) {
      if (stripePaymentLink) {
        await deactivateSalesOrderPaymentLink(
          `<!-- stripe-payment-link:${stripePaymentLink.id} -->`,
        ).catch(() => {});
      }
      console.error(`Failed to add Stripe payment link to amended sales order ${amended.name}:`, error);
      return NextResponse.json(
        { error: `${amended.name} was created as a draft, but its Stripe payment link could not be added.` },
        { status: 502 },
      );
    }
  }

  try {
    await erpSubmit('Sales Order', amended.name);
  } catch (error) {
    if (stripePaymentLink) {
      await deactivateSalesOrderPaymentLink(
        `<!-- stripe-payment-link:${stripePaymentLink.id} -->`,
      ).catch(() => {});
    }
    console.error(`Failed to submit amended sales order ${amended.name}:`, error);
    return NextResponse.json(
      { error: `${amended.name} was created but failed to submit. It remains a draft in ERPNext.` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ...amended,
    amended_from: name,
    stripe_payment_url: stripePaymentLink?.url ?? null,
  });
}
