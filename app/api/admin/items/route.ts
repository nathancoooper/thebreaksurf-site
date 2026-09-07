import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpCreate } from '@/lib/erpnext';
import { readData } from '@/lib/dataCache';
import type { Product } from '@/types';

const GROUPS = ['Raw Material', 'Products'] as const;

// Descending, matching how the team actually thinks about sizes — anything
// not in this list (one-off UOMs, "One Size", etc.) sorts after.
const SIZE_ORDER = ['XL', 'L', 'M', 'S', 'XS'];

interface RawItem {
  name: string;
  item_code: string;
  item_name: string;
  stock_uom: string;
  has_variants: number;
  default_bom: string | null;
  variant_of: string | null;
}

// Variant item codes follow "{prefix}-{Colour}-{Size}" (e.g.
// "Staple Tee-Daffodil-L") — split off the known prefix rather than fetching
// each variant's real Item Variant Attribute rows individually, which would
// mean one extra ERPNext call per variant just to render this list.
function splitVariantCode(itemCode: string, prefix: string): { colour: string; size: string } {
  const rest = itemCode.slice(prefix.length).replace(/^-/, '');
  const parts = rest.split('-');
  const size = parts.length > 1 ? parts[parts.length - 1] : '';
  const colour = parts.length > 1 ? parts.slice(0, -1).join('-') : rest;
  return { colour, size };
}

function sizeRank(size: string): number {
  const idx = SIZE_ORDER.indexOf(size.toUpperCase());
  return idx === -1 ? SIZE_ORDER.length : idx;
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { searchParams } = new URL(req.url);
  const group = searchParams.get('group');
  if (!group || !GROUPS.includes(group as typeof GROUPS[number])) {
    return NextResponse.json({ error: `group must be one of: ${GROUPS.join(', ')}` }, { status: 400 });
  }

  const items = await erpList<RawItem>('Item', {
    fields: ['name', 'item_code', 'item_name', 'stock_uom', 'has_variants', 'default_bom', 'variant_of'],
    filters: [['item_group', '=', group], ['is_stock_item', '=', 1]],
    orderBy: 'item_name asc',
    limit: 300,
  });

  // ERPNext has no item images of its own — for Products, borrow the cover
  // photo already set on the matching site product. Prefer the explicit
  // erpItemPrefix link, but fall back to matching on the plain product name
  // (e.g. "New Heights Hoodie" on both sides) since erpItemPrefix isn't
  // actually populated on any product yet.
  const images: Record<string, string> = {};
  if (group === 'Products') {
    const products = await readData<Product>('products');
    for (const p of products) {
      images[p.name] = p.images.cover;
      if (p.erpItemPrefix) images[p.erpItemPrefix] = p.images.cover;
    }
  }

  const templates = items.filter(i => i.has_variants === 1);
  const variants = items.filter(i => i.variant_of);
  const standalone = items.filter(i => !i.has_variants && !i.variant_of);

  const grouped = [
    ...templates.map(t => ({
      key: t.item_code,
      item_name: t.item_name,
      stock_uom: t.stock_uom,
      default_bom: t.default_bom,
      image: images[t.item_code] ?? null,
      variants: variants
        .filter(v => v.variant_of === t.item_code)
        .map(v => {
          const { colour, size } = splitVariantCode(v.item_code, t.item_code);
          return { name: v.name, item_code: v.item_code, item_name: v.item_name, stock_uom: v.stock_uom, colour, size };
        })
        .sort((a, b) => a.colour.localeCompare(b.colour) || sizeRank(a.size) - sizeRank(b.size)),
    })),
    ...standalone.map(s => ({
      key: s.item_code,
      item_name: s.item_name,
      stock_uom: s.stock_uom,
      default_bom: s.default_bom,
      image: images[s.item_code] ?? null,
      variants: [] as { name: string; item_code: string; item_name: string; stock_uom: string; colour: string; size: string }[],
    })),
  ].sort((a, b) => a.item_name.localeCompare(b.item_name));

  return NextResponse.json({ items: grouped });
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();
  const { item_code, item_name, item_group, stock_uom, maintain_stock, has_variants, attributes, brand, allow_sales, allow_purchases, is_fixed_asset, asset_category } = body;

  if (!item_code || !item_name || !item_group) {
    return NextResponse.json({ error: 'item_code, item_name and item_group are required' }, { status: 400 });
  }
  if (has_variants && (!Array.isArray(attributes) || attributes.length === 0)) {
    return NextResponse.json({ error: 'Pick at least one attribute (e.g. Colour, Size) for a variant template' }, { status: 400 });
  }
  if (is_fixed_asset && (!asset_category || has_variants)) {
    return NextResponse.json({ error: 'Fixed asset items require an asset category and cannot have variants.' }, { status: 400 });
  }

  const doc: Record<string, unknown> = {
    doctype: 'Item',
    item_code,
    item_name,
    item_group,
    stock_uom: stock_uom || 'Nos',
    is_stock_item: is_fixed_asset ? 0 : maintain_stock === false ? 0 : 1,
    is_purchase_item: allow_purchases === false ? 0 : 1,
    is_sales_item: allow_sales === false ? 0 : 1,
    has_variants: has_variants ? 1 : 0,
    is_fixed_asset: is_fixed_asset ? 1 : 0,
  };
  if (is_fixed_asset) doc.asset_category = asset_category;
  if (brand) doc.brand = brand;
  if (has_variants) doc.attributes = (attributes as string[]).map(a => ({ attribute: a }));

  const item = await erpCreate('Item', doc);

  return NextResponse.json(item);
}
