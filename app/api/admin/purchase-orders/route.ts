import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpCreate, erpSubmit } from '@/lib/erpnext';
import { CAPITAL_ALLOWANCE_PO_FIELD, ensureFixedAssetCustomFields, parseFixedAssetDetails } from '@/lib/fixedAsset';

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { searchParams } = new URL(req.url);
  const start = parseInt(searchParams.get('start') ?? '0');

  // custom_receipt is an Attach field — Frappe rejects Attach-type fields in
  // list queries entirely, so it can't be requested here. It's only readable
  // via a full single-doc GET, which the expanded row detail already uses.
  const orders = await erpList('Purchase Order', {
    fields: ['name', 'supplier', 'transaction_date', 'schedule_date', 'grand_total', 'status', 'docstatus'],
    orderBy: 'transaction_date desc',
    limit: 50,
    start,
  });

  return NextResponse.json({ orders, hasMore: orders.length === 50 });
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();

  let fixedAssetDetails: ReturnType<typeof parseFixedAssetDetails> | undefined;
  if (body.is_fixed_asset_purchase) {
    try {
      await ensureFixedAssetCustomFields();
      fixedAssetDetails = parseFixedAssetDetails(body.fixed_asset_details);
      const itemCodes = [...new Set<string>(body.items.map((item: { item_code: string }) => item.item_code))];
      const itemMeta = await erpList<{ name: string; is_fixed_asset: 0 | 1; asset_category: string | null }>('Item', {
        fields: ['name', 'is_fixed_asset', 'asset_category'],
        filters: [['name', 'in', itemCodes]],
        limit: itemCodes.length,
      });
      if (itemMeta.length !== itemCodes.length || itemMeta.some(item => item.is_fixed_asset !== 1)) {
        throw new Error('Every item on a fixed-asset purchase order must be configured as a fixed asset in ERPNext.');
      }
      if (itemMeta.some(item => item.asset_category !== fixedAssetDetails?.asset_category)) {
        throw new Error('The selected item and fixed-asset details must use the same Asset Category.');
      }
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid fixed asset details.' }, { status: 400 });
    }
  }

  let order: { name: string };
  try {
    order = await erpCreate<{ name: string }>('Purchase Order', {
      doctype: 'Purchase Order',
      company: 'The Break Surf',
      supplier: body.supplier,
      transaction_date: body.transaction_date,
      schedule_date: body.schedule_date,
      // Always off — a company decision, not something to re-decide per order.
      disable_rounded_total: 1,
      ...(fixedAssetDetails ? { [CAPITAL_ALLOWANCE_PO_FIELD]: JSON.stringify(fixedAssetDetails) } : {}),
      items: body.items.map((item: { item_code: string; qty: number; rate: number; warehouse?: string }) => ({
        item_code: item.item_code,
        qty: item.qty,
        rate: item.rate,
        // Fixed-asset items explicitly do not maintain stock. Sending a
        // warehouse for them makes ERPNext treat the row like stock and can
        // cause the PO/PI validation to reject an otherwise valid asset.
        ...(body.is_fixed_asset_purchase ? {} : { warehouse: item.warehouse }),
        schedule_date: body.schedule_date,
      })),
      taxes: (body.taxes ?? []).map((t: { charge_type: string; account_head: string; description: string; rate?: number; tax_amount?: number }) => ({
        charge_type: t.charge_type,
        // Supplier-charged shipping and non-recoverable VAT are both part of
        // what the stock actually cost us. They must increase the amount due
        // and the item valuation; header-level allocation is intentional and
        // ERPNext distributes the charge across the stock lines.
        category: 'Valuation and Total',
        account_head: t.account_head,
        description: t.description,
        rate: t.rate ?? 0,
        tax_amount: t.tax_amount ?? 0,
      })),
    });
  } catch (err) {
    // Without this, a real ERPNext validation error (e.g. an item_code
    // that doesn't exist) throws unhandled, and the client only ever sees
    // a generic 500 with no explanation of what actually went wrong.
    console.error('Failed to create purchase order:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'ERPNext rejected this order.' }, { status: 502 });
  }

  // Left as a draft otherwise — a draft PO doesn't actually post anything in
  // ERPNext (no per_received tracking, nothing a Purchase Invoice can be
  // made against), so it has to be submitted to actually count as "created"
  // from the admin panel's point of view.
  try {
    await erpSubmit('Purchase Order', order.name);
  } catch (err) {
    console.error(`Failed to auto-submit purchase order ${order.name}:`, err);
    return NextResponse.json(
      { error: `${order.name} was created but failed to submit — it's sitting as a draft. Check it directly in ERPNext before retrying.` },
      { status: 502 },
    );
  }

  return NextResponse.json(order);
}
