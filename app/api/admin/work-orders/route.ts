import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpCreate, erpGet, erpFetch } from '@/lib/erpnext';
import { stockBalanceAsOf } from '@/lib/stockAsOf';

const SOURCE_WAREHOUSE = 'Stores - TBS';
const WIP_WAREHOUSE = 'Work In Progress - TBS';
const FG_WAREHOUSE = 'Finished Goods - TBS';

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const orders = await erpList('Work Order', {
    fields: ['name', 'production_item', 'qty', 'produced_qty', 'status', 'planned_start_date', 'docstatus'],
    orderBy: 'planned_start_date desc',
    limit: 100,
  });
  return NextResponse.json({ orders });
}

interface CreateItem { item_code: string; bom_no: string; qty: number }
interface ResultRow { item_code: string; wo?: string; stockEntry?: string; error?: string }

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();

  if (!Array.isArray(body.items) || body.items.length === 0 || !body.planned_date) {
    return NextResponse.json({ error: 'At least one item and a planned date are required' }, { status: 400 });
  }

  const results: ResultRow[] = [];

  for (const line of body.items as CreateItem[]) {
    try {
      // A WO backlogged to an earlier date shouldn't be able to draw on
      // stock that only arrived later — check each raw material's balance
      // as it stood on the planned date, not what's on hand right now.
      const bom = await erpGet<{ items: { item_code: string; qty: number }[] }>('BOM', line.bom_no);
      const shortages: string[] = [];
      for (const bomLine of bom.items) {
        const required = bomLine.qty * line.qty;
        const available = await stockBalanceAsOf(bomLine.item_code, SOURCE_WAREHOUSE, body.planned_date);
        if (available < required) {
          shortages.push(`${bomLine.item_code} (needs ${required}, had ${available} on ${body.planned_date})`);
        }
      }
      if (shortages.length > 0) {
        results.push({ item_code: line.item_code, error: `Not enough stock as of ${body.planned_date}: ${shortages.join('; ')}` });
        continue;
      }

      const wo = await erpCreate<{ name: string }>('Work Order', {
        doctype: 'Work Order',
        company: 'The Break Surf',
        production_item: line.item_code,
        bom_no: line.bom_no,
        qty: line.qty,
        planned_start_date: `${body.planned_date} 12:00:00`,
        wip_warehouse: WIP_WAREHOUSE,
        fg_warehouse: FG_WAREHOUSE,
        source_warehouse: SOURCE_WAREHOUSE,
        // Raw materials are consumed straight from Stores — matches how
        // several of the real historical WOs were actually done, and skips
        // needing a separate Material Transfer step for a backlogged run.
        skip_transfer: 1,
      });

      const woDoc = await erpGet<Record<string, unknown>>('Work Order', wo.name);
      await erpFetch('/api/method/frappe.client.submit', {
        method: 'POST',
        body: JSON.stringify({ doc: JSON.stringify(woDoc) }),
      });

      // Prepares the Manufacture stock entry (raw material consumption +
      // finished stock) but deliberately leaves it as a draft — completing
      // it is a separate, explicit action from the Work Orders list, so
      // nothing hits real stock without a final manual check.
      const mseRes = await erpFetch('/api/method/erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry', {
        method: 'POST',
        body: JSON.stringify({ work_order_id: wo.name, purpose: 'Manufacture' }),
      });
      const mse = mseRes.message as Record<string, unknown>;
      mse.posting_date = body.planned_date;
      mse.set_posting_time = 1;

      const inserted = await erpFetch('/api/method/frappe.client.insert', {
        method: 'POST',
        body: JSON.stringify({ doc: JSON.stringify(mse) }),
      });

      results.push({ item_code: line.item_code, wo: wo.name, stockEntry: inserted.message.name });
    } catch (err) {
      console.error(`Failed to create Work Order for ${line.item_code}:`, err);
      results.push({ item_code: line.item_code, error: err instanceof Error ? err.message : 'Failed to create.' });
    }
  }

  return NextResponse.json({ results });
}
