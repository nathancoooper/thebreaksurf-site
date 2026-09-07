import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpGet, erpList, erpSetValue } from '@/lib/erpnext';

interface ProjectEntry { doctype: string; name: string; date: string; amount: number; party: string }

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;

  const project = await erpGet<{ name: string; project_name: string; status: string; notes: string | null }>('Project', name);

  const [invoices, orders] = await Promise.all([
    erpList<{ name: string; posting_date: string; grand_total: number; customer: string }>('Sales Invoice', {
      fields: ['name', 'posting_date', 'grand_total', 'customer'],
      filters: [['project', '=', name], ['docstatus', '=', 1]],
      limit: 200,
    }),
    erpList<{ name: string; transaction_date: string; grand_total: number; supplier: string }>('Purchase Order', {
      fields: ['name', 'transaction_date', 'grand_total', 'supplier'],
      filters: [['project', '=', name], ['docstatus', '=', 1]],
      limit: 200,
    }),
  ]);

  const entries: ProjectEntry[] = [
    ...invoices.map(i => ({ doctype: 'Sales Invoice', name: i.name, date: i.posting_date, amount: i.grand_total, party: i.customer })),
    ...orders.map(o => ({ doctype: 'Purchase Order', name: o.name, date: o.transaction_date, amount: o.grand_total, party: o.supplier })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const revenue = invoices.reduce((sum, i) => sum + i.grand_total, 0);
  const cost = orders.reduce((sum, o) => sum + o.grand_total, 0);

  return NextResponse.json({ project, entries, revenue, cost, margin: revenue - cost });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;
  const body = await req.json() as { notes?: string; status?: string };

  if (typeof body.notes === 'string') {
    await erpSetValue('Project', name, 'notes', body.notes);
  }
  if (typeof body.status === 'string') {
    await erpSetValue('Project', name, 'status', body.status);
  }

  return NextResponse.json({ ok: true });
}
