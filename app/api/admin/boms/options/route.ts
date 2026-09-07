import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList } from '@/lib/erpnext';

interface ItemRow { name: string; item_code: string; item_name: string; has_variants: 0 | 1; variant_of: string | null; include_item_in_manufacturing: 0 | 1 }

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const [items, boms, rawMaterials] = await Promise.all([
    erpList<ItemRow>('Item', {
      fields: ['name', 'item_code', 'item_name', 'has_variants', 'variant_of', 'include_item_in_manufacturing'],
      filters: [['item_group', '=', 'Products']],
      limit: 300,
    }),
    erpList<{ item: string; name: string }>('BOM', {
      fields: ['item', 'name'],
      filters: [['is_active', '=', 1]],
      limit: 300,
    }),
    // Same raw-material pool used for the PO item picker — anything
    // purchasable that can go into a BOM line. Brand included so the BOM
    // page's picker can group by brand the same way the PO picker groups
    // by category.
    erpList<{ name: string; item_code: string; item_name: string; stock_uom: string; brand: string | null }>('Item', {
      fields: ['name', 'item_code', 'item_name', 'stock_uom', 'brand'],
      filters: [['item_group', '=', 'Raw Material'], ['is_stock_item', '=', 1], ['has_variants', '=', 0]],
      orderBy: 'item_name asc',
      limit: 300,
    }),
  ]);

  const bomByItem = new Map(boms.map(b => [b.item, b.name]));
  // Pre-printed/pre-made items (e.g. Stickers) are purchased as-is with
  // nothing to manufacture — "Include Item In Manufacturing" unchecked on
  // the template is how that's marked, so they don't belong on a BOM page.
  const templates = items.filter(i => i.has_variants && i.include_item_in_manufacturing);
  const standaloneItems = items.filter(i =>
    !i.has_variants
    && !i.variant_of
    && i.include_item_in_manufacturing,
  );

  const products = [
    ...templates.map(t => ({
      name: t.name,
      standalone: false,
      variants: items
        .filter(i => i.variant_of === t.name)
        .map(v => ({ item_code: v.item_code, item_name: v.item_name, bom: bomByItem.get(v.item_code) ?? null }))
        .sort((a, b) => a.item_code.localeCompare(b.item_code)),
    })).filter(p => p.variants.length > 0),
    ...standaloneItems.map(item => ({
      name: item.item_name,
      standalone: true,
      variants: [{
        item_code: item.item_code,
        item_name: item.item_name,
        bom: bomByItem.get(item.item_code) ?? null,
      }],
    })),
  ]
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ products, rawMaterials });
}
