import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpGet, erpFetch } from '@/lib/erpnext';

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;

  const entries = await erpList<{ name: string }>('Stock Entry', {
    fields: ['name'],
    filters: [['work_order', '=', name], ['docstatus', '=', 0], ['purpose', '=', 'Manufacture']],
    limit: 1,
  });
  if (entries.length === 0) {
    return NextResponse.json({ error: 'No draft completion entry found for this Work Order — it may already be completed, or failed to prepare when created.' }, { status: 404 });
  }

  const seDoc = await erpGet<Record<string, unknown>>('Stock Entry', entries[0].name);
  try {
    await erpFetch('/api/method/frappe.client.submit', {
      method: 'POST',
      body: JSON.stringify({ doc: JSON.stringify(seDoc) }),
    });
  } catch (err) {
    console.error(`Failed to submit completion entry for ${name}:`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to submit.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, stockEntry: entries[0].name });
}
