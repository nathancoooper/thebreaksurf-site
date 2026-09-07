import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpCreate, erpSubmit, erpFetch, erpSetValue } from '@/lib/erpnext';

interface Line { item_code: string; qty: number }

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();

  if (!body.item_code || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'item_code and at least one raw material line are required' }, { status: 400 });
  }

  // A BOM's item lines can't be edited in place once submitted — cancelling
  // the old one and creating a fresh revision is the normal ERPNext pattern
  // for changing what a product is made of.
  const existing = await erpList<{ name: string; docstatus: number }>('BOM', {
    fields: ['name', 'docstatus'],
    filters: [['item', '=', body.item_code], ['is_active', '=', 1]],
    limit: 5,
  });
  for (const b of existing) {
    if (b.docstatus === 1) {
      await erpFetch('/api/method/frappe.client.cancel', {
        method: 'POST',
        body: JSON.stringify({ doctype: 'BOM', name: b.name }),
      });
    }
    await erpSetValue('BOM', b.name, 'is_active', 0);
  }

  const bom = await erpCreate<{ name: string }>('BOM', {
    doctype: 'BOM',
    item: body.item_code,
    quantity: 1,
    is_active: 1,
    is_default: 1,
    company: 'The Break Surf',
    items: (body.items as Line[]).map(i => ({ item_code: i.item_code, qty: i.qty })),
  });

  try {
    await erpSubmit('BOM', bom.name);
  } catch (err) {
    console.error(`Failed to auto-submit BOM ${bom.name}:`, err);
    return NextResponse.json(
      { error: `${bom.name} was created but failed to submit — it's sitting as a draft. Check it directly in ERPNext before retrying.` },
      { status: 502 },
    );
  }

  return NextResponse.json(bom);
}
