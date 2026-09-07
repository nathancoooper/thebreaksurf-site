import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpGet, erpList, erpCreate, erpSubmit } from '@/lib/erpnext';
import { CAPITAL_ALLOWANCE_PO_FIELD, ensureFixedAssetCustomFields, parseFixedAssetDetails, type FixedAssetDetails } from '@/lib/fixedAsset';

interface POItem { name: string; item_code: string; item_name: string; qty: number; rate: number; warehouse?: string }
interface POTax { charge_type: string; category?: string; account_head: string; description: string; rate: number; tax_amount: number }
interface PODoc { supplier: string; transaction_date: string; creation: string; grand_total: number; items: POItem[]; taxes: POTax[]; custom_fixed_asset_details?: string | null }
interface ItemMeta { name: string; item_name: string; is_fixed_asset: 0 | 1; asset_category: string | null }
interface PIItem {
  name: string;
  item_code: string;
  item_name: string;
  qty: number;
  base_net_amount: number;
  item_tax_amount: number;
  valuation_rate: number;
}
interface PIDoc { name: string; items: PIItem[] }

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;
  const body = await req.json();

  const po = await erpGet<PODoc>('Purchase Order', name);
  const itemCodes = [...new Set(po.items.map(item => item.item_code))];
  const itemMeta = await erpList<ItemMeta>('Item', {
    fields: ['name', 'item_name', 'is_fixed_asset', 'asset_category'],
    filters: [['name', 'in', itemCodes]],
    limit: itemCodes.length,
  });
  const itemByCode = new Map(itemMeta.map(item => [item.name, item]));
  const fixedRows = po.items.filter(item => itemByCode.get(item.item_code)?.is_fixed_asset === 1);
  const isFixedAssetInvoice = fixedRows.length > 0;
  let fixedAssetDetails: FixedAssetDetails | undefined;
  if (isFixedAssetInvoice) {
    try {
      await ensureFixedAssetCustomFields();
      if (!po[CAPITAL_ALLOWANCE_PO_FIELD]) {
        throw new Error(
          'This fixed-asset PO has no accounting and tax details. Add them before creating its Purchase Invoice so ERPNext can build the depreciation schedule before the Asset is submitted.',
        );
      }
      fixedAssetDetails = parseFixedAssetDetails(po[CAPITAL_ALLOWANCE_PO_FIELD]);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'The fixed asset details on this PO are invalid.' }, { status: 400 });
    }
  }

  // A mixed stock/fixed-asset invoice cannot have a single correct
  // update_stock value. The UI prevents this, and this guard keeps direct API
  // calls from silently producing the wrong ledger/stock result.
  if (isFixedAssetInvoice && fixedRows.length !== po.items.length) {
    return NextResponse.json({ error: 'Fixed assets and stock items must be filed on separate purchase orders.' }, { status: 400 });
  }

  const assetLocation = isFixedAssetInvoice
    ? fixedAssetDetails!.location
    : undefined;

  // Mirrors the PO's own timestamp exactly, rather than defaulting to
  // whenever this button happens to get clicked — this is billing a PO
  // that was (often, when backlogging) placed on a specific historical
  // date, not creating a brand new transaction today.
  const posting_time = po.creation.split(' ')[1] ?? '00:00:00';

  const invoice = await erpCreate<{ name: string }>('Purchase Invoice', {
    doctype: 'Purchase Invoice',
    company: 'The Break Surf',
    supplier: po.supplier,
    posting_date: po.transaction_date,
    posting_time,
    set_posting_time: 1,
    // This button bills a PO that's already been paid for and received, not
    // an on-account invoice awaiting later payment. Fixed assets never update
    // stock; ordinary inventory purchases still do.
    is_paid: 1,
    mode_of_payment: body.mode_of_payment,
    cash_bank_account: body.cash_bank_account,
    paid_amount: po.grand_total,
    update_stock: isFixedAssetInvoice ? 0 : 1,
    disable_rounded_total: 1,
    items: po.items.map(item => ({
      item_code: item.item_code,
      qty: item.qty,
      rate: item.rate,
      ...(isFixedAssetInvoice ? { asset_location: assetLocation } : { warehouse: item.warehouse }),
      purchase_order: name,
      po_detail: item.name,
    })),
    taxes: po.taxes.map(t => ({
      charge_type: t.charge_type,
      category: t.category ?? 'Valuation and Total',
      account_head: t.account_head,
      description: t.description,
      rate: t.rate,
      tax_amount: t.tax_amount,
    })),
  });

  try {
    await erpSubmit('Purchase Invoice', invoice.name);
  } catch (err) {
    console.error(`Failed to auto-submit purchase invoice ${invoice.name}:`, err);
    return NextResponse.json(
      { error: `${invoice.name} was created but failed to submit — it's sitting as a draft. Check it directly in ERPNext before retrying.` },
      { status: 502 },
    );
  }

  const assetNames: string[] = [];
  let assetError: string | undefined;

  if (isFixedAssetInvoice) {
    try {
      const submittedInvoice = await erpGet<PIDoc>('Purchase Invoice', invoice.name);
      const totalAssetValue = submittedInvoice.items.reduce((total, row) => {
        const rowValue = row.valuation_rate > 0
          ? row.valuation_rate * row.qty
          : (row.base_net_amount ?? 0) + (row.item_tax_amount ?? 0);
        return total + rowValue;
      }, 0);
      for (const row of submittedInvoice.items) {
        const meta = itemByCode.get(row.item_code);
        if (!meta?.is_fixed_asset) continue;

        const quantity = Math.round(row.qty);
        if (quantity <= 0 || Math.abs(row.qty - quantity) > 0.0001) {
          throw new Error(`${row.item_name} must use a whole-number quantity to create individual Asset records.`);
        }

        // Valuation charges (including non-recoverable VAT and freight) are
        // distributed onto the PI row by ERPNext. Prefer valuation_rate and
        // fall back to net amount + allocated item tax for older ERPNext
        // versions where the non-stock row leaves valuation_rate blank.
        const perAssetValue = row.valuation_rate > 0
          ? row.valuation_rate
          : ((row.base_net_amount ?? 0) + (row.item_tax_amount ?? 0)) / quantity;

        for (let index = 0; index < quantity; index += 1) {
          const label = quantity > 1 ? `${meta.item_name} (${index + 1} of ${quantity})` : meta.item_name;
          const qualifyingCost = fixedAssetDetails && totalAssetValue > 0
            ? fixedAssetDetails.ca_qualifying_cost * (perAssetValue / totalAssetValue)
            : 0;
          const financeBooks = fixedAssetDetails ? [{
            depreciation_method: fixedAssetDetails.depreciation_method,
            frequency_of_depreciation: fixedAssetDetails.posting_frequency_months,
            total_number_of_depreciations: fixedAssetDetails.useful_life_years * 12 / fixedAssetDetails.posting_frequency_months,
            depreciation_start_date: fixedAssetDetails.depreciation_start_date,
            expected_value_after_useful_life: fixedAssetDetails.residual_value,
          }] : undefined;
          const asset = await erpCreate<{ name: string }>('Asset', {
            doctype: 'Asset',
            item_code: row.item_code,
            asset_name: label,
            company: 'The Break Surf',
            location: assetLocation,
            purchase_invoice: invoice.name,
            purchase_invoice_item: row.name,
            purchase_date: po.transaction_date,
            available_for_use_date: fixedAssetDetails?.available_for_use_date ?? po.transaction_date,
            net_purchase_amount: perAssetValue,
            calculate_depreciation: fixedAssetDetails ? 1 : 0,
            ...(fixedAssetDetails ? {
              asset_category: fixedAssetDetails.asset_category,
              finance_books: financeBooks,
              custom_ca_pool: fixedAssetDetails.ca_pool,
              custom_ca_treatment: fixedAssetDetails.ca_treatment,
              custom_ca_qualifying_cost: qualifyingCost,
              custom_ca_eligibility_status: fixedAssetDetails.ca_eligibility_status,
              custom_tax_notes: fixedAssetDetails.tax_notes,
            } : {}),
          });
          // An Asset left in draft does not become an active fixed asset in
          // ERPNext. This workflow is already explicitly confirmed by the
          // user's "+" action, so finish the same create-and-submit sequence
          // used for the PI before exposing the green Asset indicator.
          await erpSubmit('Asset', asset.name);
          assetNames.push(asset.name);
        }
      }
    } catch (err) {
      // The PI is already submitted and must never be duplicated just because
      // Asset creation needs attention. Return the successful PI together
      // with the actionable Asset error so the UI can advance the primary
      // link and show a pending Asset state.
      console.error(`Purchase Invoice ${invoice.name} submitted but Asset creation failed:`, err);
      assetError = err instanceof Error ? err.message : 'Asset creation failed.';
    }
  }

  return NextResponse.json({ ...invoice, is_fixed_asset_invoice: isFixedAssetInvoice, asset_names: assetNames, asset_error: assetError });
}
