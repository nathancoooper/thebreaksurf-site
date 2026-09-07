import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readSupplierAliases, writeSupplierAliases, type Supplier } from '@/lib/supplierAliases';

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const data = await readSupplierAliases();
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json() as { suppliers?: Supplier[] };
  if (!Array.isArray(body.suppliers)) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }
  await writeSupplierAliases({ suppliers: body.suppliers });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json() as { supplierName?: string; itemCode?: string; alias?: string };
  if (!body.supplierName || !body.itemCode || !body.alias?.trim()) {
    return NextResponse.json({ error: 'supplierName, itemCode and alias are required' }, { status: 400 });
  }

  const data = await readSupplierAliases();
  let supplier = data.suppliers.find(s => s.name.toUpperCase() === body.supplierName!.toUpperCase());
  if (!supplier) {
    supplier = { name: body.supplierName.toUpperCase(), items: [] };
    data.suppliers.push(supplier);
  }

  let item = supplier.items.find(i => i.item_code === body.itemCode);
  if (!item) {
    item = { item_code: body.itemCode, item_name: body.itemCode, aliases: [] };
    supplier.items.push(item);
  }

  const alias = body.alias.trim();
  if (!item.aliases.includes(alias)) {
    item.aliases.push(alias);
  }

  await writeSupplierAliases(data);
  return NextResponse.json({ ok: true });
}
