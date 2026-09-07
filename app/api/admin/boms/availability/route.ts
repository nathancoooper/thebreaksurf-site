import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpGet } from '@/lib/erpnext';

interface ReqItem { item_code: string; bom_no: string }
interface BomLine { item_code: string; qty: number }

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();
  const items: ReqItem[] = Array.isArray(body.items) ? body.items : [];
  const date: string = body.date;
  if (items.length === 0 || !date) return NextResponse.json({ availability: {} });

  const boms = await Promise.all(
    items.map(async i => {
      const bom = await erpGet<{ items: BomLine[] }>('BOM', i.bom_no);
      return { item_code: i.item_code, lines: bom.items.map(l => ({ item_code: l.item_code, qty: l.qty })) };
    }),
  );

  const materialCodes = Array.from(new Set(boms.flatMap(b => b.lines.map(l => l.item_code))));
  if (materialCodes.length === 0) return NextResponse.json({ availability: {} });

  // Historical balance as of the selected date, not today's live Bin
  // balance — sums every Stock Ledger Entry up to and including that date,
  // the same way stock was traced by hand earlier this session. Deliberately
  // not filtered to a single warehouse: some historical Purchase Invoices
  // received raw materials straight into Work In Progress rather than
  // Stores, so restricting to one warehouse undercounts stock that
  // genuinely existed at the time, just sitting in a different bucket.
  const entries = await erpList<{ item_code: string; actual_qty: number }>('Stock Ledger Entry', {
    fields: ['item_code', 'actual_qty'],
    filters: [
      ['item_code', 'in', materialCodes],
      ['posting_date', '<=', date],
    ],
    limit: 5000,
  });

  const balances = new Map<string, number>();
  for (const e of entries) balances.set(e.item_code, (balances.get(e.item_code) ?? 0) + e.actual_qty);

  const availability: Record<string, number> = {};
  for (const b of boms) {
    if (b.lines.length === 0) continue;
    const maxBuildable = Math.min(...b.lines.map(l => Math.floor((balances.get(l.item_code) ?? 0) / l.qty)));
    availability[b.item_code] = Math.max(0, maxBuildable);
  }

  return NextResponse.json({ availability });
}
