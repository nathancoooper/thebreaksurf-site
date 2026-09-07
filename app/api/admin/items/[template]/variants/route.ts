import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpGet, erpUpdate, erpCreate } from '@/lib/erpnext';

interface ItemAttributeValue { attribute_value: string; abbr: string }
interface ItemAttributeDoc { name: string; item_attribute_values: ItemAttributeValue[] }
interface TemplateItem {
  item_code: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  is_stock_item: number;
  is_purchase_item: number;
  is_sales_item: number;
  attributes: { attribute: string }[];
}

// Case-insensitive match against existing values (e.g. typing "forest green"
// should reuse "Forest Green" rather than create a near-duplicate) — creates
// the value on the shared Item Attribute doc if nothing matches. Returns the
// abbr too since item codes are built from that (e.g. Size's "Large" has
// abbr "L" — existing items are named "...-L", not "...-Large").
async function ensureAttributeValue(attribute: string, value: string): Promise<{ attribute_value: string; abbr: string }> {
  const doc = await erpGet<ItemAttributeDoc>('Item Attribute', attribute);
  const existing = doc.item_attribute_values.find(v => v.attribute_value.toLowerCase() === value.toLowerCase());
  if (existing) return existing;

  await erpUpdate('Item Attribute', attribute, {
    item_attribute_values: [...doc.item_attribute_values, { attribute_value: value, abbr: value }],
  });
  return { attribute_value: value, abbr: value };
}

// Which attributes this template varies by, and every value already in use
// for each — populates the picker's combobox suggestions.
export async function GET(req: NextRequest, { params }: { params: Promise<{ template: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { template } = await params;
  const doc = await erpGet<TemplateItem>('Item', decodeURIComponent(template));

  const attributes = await Promise.all(
    (doc.attributes ?? []).map(async a => {
      const attrDoc = await erpGet<ItemAttributeDoc>('Item Attribute', a.attribute);
      return { attribute: a.attribute, values: attrDoc.item_attribute_values.map(v => v.attribute_value) };
    }),
  );

  return NextResponse.json({ attributes });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ template: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { template } = await params;
  const templateCode = decodeURIComponent(template);
  const body = await req.json();
  const values: Record<string, string> = body.values ?? {};

  const doc = await erpGet<TemplateItem>('Item', templateCode);
  if (!doc.attributes || doc.attributes.length === 0) {
    return NextResponse.json({ error: `${templateCode} has no variant attributes configured` }, { status: 400 });
  }

  const resolved: { attribute: string; attribute_value: string; abbr: string }[] = [];
  for (const a of doc.attributes) {
    const raw = (values[a.attribute] ?? '').trim();
    if (!raw) return NextResponse.json({ error: `${a.attribute} is required` }, { status: 400 });
    const { attribute_value, abbr } = await ensureAttributeValue(a.attribute, raw);
    resolved.push({ attribute: a.attribute, attribute_value, abbr });
  }

  // Item codes follow the existing convention of using each attribute's
  // abbreviation (e.g. Size's "Large" -> "L"), not its full display value.
  const suffix = resolved.map(r => r.abbr).join('-');
  const item_code = `${templateCode}-${suffix}`;
  const item_name = `${doc.item_name}-${suffix}`;

  let item;
  try {
    item = await erpCreate<{ name: string; item_code: string; item_name: string; stock_uom: string }>('Item', {
      item_code,
      item_name,
      item_group: doc.item_group,
      stock_uom: doc.stock_uom,
      is_stock_item: doc.is_stock_item,
      is_purchase_item: doc.is_purchase_item,
      is_sales_item: doc.is_sales_item,
      variant_of: templateCode,
      attributes: resolved.map(r => ({ attribute: r.attribute, attribute_value: r.attribute_value })),
    });
  } catch (err) {
    // A duplicate colour/size combo (LinkValidationError-style rejection)
    // is the most likely real failure here — surface ERPNext's actual
    // message rather than a generic 500.
    console.error(`Failed to create variant of ${templateCode}:`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'ERPNext rejected this variant.' }, { status: 502 });
  }

  return NextResponse.json(item);
}
