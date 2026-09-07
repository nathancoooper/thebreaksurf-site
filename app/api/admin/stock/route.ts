import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpCached, ERP_CACHE_HOUR } from '@/lib/erpnext';

interface Bin {
  item_code: string;
  warehouse: string;
  actual_qty: number;
  reserved_qty: number;
  ordered_qty: number;
  valuation_rate: number;
  stock_value: number;
}

interface Item {
  name: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  variant_of: string | null;
  image: string | null;
}

interface Warehouse { name: string; warehouse_name: string }

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const { data: result, fetchedAt } = await erpCached('stock', ERP_CACHE_HOUR, async () => {
    const [bins, items, warehouses] = await Promise.all([
      erpList<Bin>('Bin', {
        fields: ['item_code', 'warehouse', 'actual_qty', 'reserved_qty', 'ordered_qty', 'valuation_rate', 'stock_value'],
        filters: [['actual_qty', '!=', 0]],
        orderBy: 'item_code asc',
        limit: 500,
      }),
      erpList<Item>('Item', {
        fields: ['name', 'item_name', 'item_group', 'stock_uom', 'variant_of', 'image'],
        limit: 500,
      }),
      erpList<Warehouse>('Warehouse', {
        fields: ['name', 'warehouse_name'],
        filters: [['is_group', '=', 0]],
        orderBy: 'warehouse_name asc',
        limit: 50,
      }),
    ]);

    const itemMap = Object.fromEntries(items.map(i => [i.name, i]));

    // Also fetch parent item images for variant groups (e.g. "Stickers")
    const parentNames = [...new Set(Object.values(itemMap).map(i => i.variant_of).filter(Boolean))] as string[];
    const parentItems = parentNames.length > 0
      ? await erpList<{ name: string; image: string | null }>('Item', {
          fields: ['name', 'image'],
          filters: [['name', 'in', parentNames]],
          limit: parentNames.length + 10,
        })
      : [];
    const parentImageMap = Object.fromEntries(parentItems.map(i => [i.name, i.image]));

    const stock = bins.map(b => ({
      ...b,
      item_name:    itemMap[b.item_code]?.item_name  ?? b.item_code,
      item_group:   itemMap[b.item_code]?.item_group ?? 'Other',
      variant_of:   itemMap[b.item_code]?.variant_of ?? null,
      uom:          itemMap[b.item_code]?.stock_uom  ?? 'Nos',
      available:    b.actual_qty - b.reserved_qty,
      item_image:   itemMap[b.item_code]?.image ?? null,
      parent_image: itemMap[b.item_code]?.variant_of ? (parentImageMap[itemMap[b.item_code].variant_of!] ?? null) : null,
    }));

    const groups = [...new Set(stock.map(s => s.item_group))].sort();

    return { stock, warehouses, groups };
  });

  return NextResponse.json({ ...result, fetchedAt });
}
