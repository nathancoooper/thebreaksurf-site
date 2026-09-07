import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList } from '@/lib/erpnext';
import { ensureFixedAssetCustomFields } from '@/lib/fixedAsset';

interface PurchasableItem {
  name: string;
  item_code: string;
  item_name: string;
  stock_uom: string;
  variant_of: string | null;
  brand: string | null;
  item_group: string;
}

async function listPurchasableItems() {
  const pageSize = 200;
  const items: PurchasableItem[] = [];
  let start = 0;

  while (true) {
    const page = await erpList<PurchasableItem>('Item', {
      fields: ['name', 'item_code', 'item_name', 'stock_uom', 'variant_of', 'brand', 'item_group'],
      filters: [['is_purchase_item', '=', 1], ['is_stock_item', '=', 1], ['has_variants', '=', 0], ['disabled', '=', 0]],
      orderBy: 'item_name asc',
      limit: pageSize,
      start,
    });
    items.push(...page);
    if (page.length < pageSize) return items;
    start += page.length;
  }
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  await ensureFixedAssetCustomFields();

  const [suppliers, items, fixedAssetItems, warehouses, chargeAccounts, assetCategories, assetLocations, fiscalYears] = await Promise.all([
    erpList<{ name: string; supplier_name: string }>('Supplier', {
      fields: ['name', 'supplier_name'],
      orderBy: 'supplier_name asc',
      limit: 100,
    }),
    // All purchasable stock items — this includes both raw materials and
    // finished products that the business buys in (for example stickers).
    // Template/parent items are excluded because they do not hold stock;
    // only their concrete variants can be placed on a Purchase Order.
    // variant_of is included so the picker can tell which family is backed by
    // a real ERPNext variant template (and can therefore have a new variant
    // added to it) versus a plain standalone item.
    listPurchasableItems(),
    // Fixed assets deliberately do not maintain stock, so the normal raw-
    // material filter above can never return them. Keep them as a separate
    // collection so the PO form can switch cleanly between stock purchases
    // and asset purchases without allowing a mixed invoice by accident.
    erpList<{ name: string; item_code: string; item_name: string; stock_uom: string; asset_category: string | null }>('Item', {
      fields: ['name', 'item_code', 'item_name', 'stock_uom', 'asset_category'],
      filters: [['is_fixed_asset', '=', 1], ['disabled', '=', 0], ['has_variants', '=', 0]],
      orderBy: 'item_name asc',
      limit: 200,
    }),
    erpList<{ name: string; warehouse_name: string }>('Warehouse', {
      fields: ['name', 'warehouse_name'],
      filters: [['is_group', '=', 0]],
      orderBy: 'warehouse_name asc',
      limit: 50,
    }),
    // Accounts suitable for a Purchase Taxes and Charges row — VAT (Tax) and
    // freight/shipping (Chargeable) both live under these account_types.
    erpList<{ name: string; account_name: string }>('Account', {
      fields: ['name', 'account_name'],
      filters: [['account_type', 'in', ['Tax', 'Chargeable']], ['is_group', '=', 0]],
      orderBy: 'account_name asc',
      limit: 50,
    }),
    erpList<{ name: string; asset_category_name: string; non_depreciable_category: 0 | 1 }>('Asset Category', {
      fields: ['name', 'asset_category_name', 'non_depreciable_category'],
      orderBy: 'asset_category_name asc',
      limit: 100,
    }),
    erpList<{ name: string; location_name: string }>('Location', {
      fields: ['name', 'location_name'],
      filters: [['is_group', '=', 0]],
      orderBy: 'location_name asc',
      limit: 100,
    }),
    erpList<{ name: string; year_start_date: string; year_end_date: string }>('Fiscal Year', {
      fields: ['name', 'year_start_date', 'year_end_date'],
      filters: [['disabled', '=', 0]],
      orderBy: 'year_start_date asc',
      limit: 100,
    }),
  ]);

  return NextResponse.json({ suppliers, items, fixedAssetItems, warehouses, chargeAccounts, assetCategories, assetLocations, fiscalYears });
}
