import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpGet } from '@/lib/erpnext';

interface BomListRow { name: string; docstatus: number; creation: string }

export async function GET(req: NextRequest, { params }: { params: Promise<{ item: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { item } = await params;
  const itemCode = decodeURIComponent(item);

  // Every revision ever made for this item, not just the active one — lets
  // the BOM page show version history and offer to restore an old one
  // (as a fresh revision, since a cancelled BOM can't be resubmitted as-is).
  const allBoms = await erpList<BomListRow>('BOM', {
    fields: ['name', 'docstatus', 'creation'],
    filters: [['item', '=', itemCode]],
    orderBy: 'creation desc',
    limit: 50,
  });

  const active = allBoms.find(b => b.docstatus === 1);
  const withItems = await Promise.all(
    allBoms.map(async b => {
      const doc = await erpGet<{ name: string; items: { item_code: string; qty: number }[] }>('BOM', b.name);
      return { name: b.name, creation: b.creation, docstatus: b.docstatus, items: doc.items.map(i => ({ item_code: i.item_code, qty: i.qty })) };
    }),
  );

  const bom = active ? withItems.find(b => b.name === active.name) ?? null : null;

  return NextResponse.json({
    bom: bom ? { name: bom.name, items: bom.items } : null,
    history: withItems,
  });
}
