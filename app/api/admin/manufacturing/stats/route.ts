import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList } from '@/lib/erpnext';
import { readData } from '@/lib/dataCache';
import type { Product } from '@/types';
import { variantFamily, variantSize } from '@/lib/variantNaming';

const FG_WAREHOUSE = 'Finished Goods - TBS';
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL'];

// Finished-goods item codes follow "Product-Colour-Size" — the same
// trailing-segment convention as raw materials, split twice to recover the
// plain product name (used as the key in products.json, which prices
// per-product, not per-variant) plus the colour and size individually.
function parseVariant(itemCode: string): { product: string; colour: string; size: string } {
  const size = variantSize(itemCode);
  const rest = variantFamily(itemCode);
  const colour = variantSize(rest);
  const product = variantFamily(rest);
  return { product: product || itemCode, colour, size };
}

function sizeRank(size: string): number {
  const idx = SIZE_ORDER.indexOf(size.toUpperCase());
  return idx === -1 ? SIZE_ORDER.length : idx;
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const bins = await erpList<{ item_code: string; actual_qty: number; stock_value: number }>('Bin', {
    fields: ['item_code', 'actual_qty', 'stock_value'],
    filters: [['warehouse', '=', FG_WAREHOUSE], ['actual_qty', '>', 0]],
    limit: 1000,
  });

  const products = await readData<Product>('products');
  const priceByName = new Map(products.map(p => [p.name, p.price]));

  let totalUnits = 0;
  let totalCost = 0;
  let totalValue = 0;

  const groups = new Map<string, { colour: string; size: string; qty: number; unitPrice: number }[]>();

  for (const b of bins) {
    const { product: productName, colour, size } = parseVariant(b.item_code);
    // Price is stored in pence; missing products (e.g. a discontinued line) just contribute £0 rather than blocking the whole total.
    const priceInPence = priceByName.get(productName) ?? 0;
    const unitPrice = priceInPence / 100;

    totalUnits += b.actual_qty;
    totalCost += b.stock_value;
    totalValue += unitPrice * b.actual_qty;

    if (!groups.has(productName)) groups.set(productName, []);
    groups.get(productName)!.push({ colour, size, qty: b.actual_qty, unitPrice });
  }

  const productBreakdown = Array.from(groups.entries())
    .map(([name, variants]) => ({
      name,
      totalQty: variants.reduce((sum, v) => sum + v.qty, 0),
      totalValue: variants.reduce((sum, v) => sum + v.unitPrice * v.qty, 0),
      variants: variants.sort((a, b) => a.colour.localeCompare(b.colour) || sizeRank(a.size) - sizeRank(b.size)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ totalUnits, totalCost, totalValue, productBreakdown });
}
