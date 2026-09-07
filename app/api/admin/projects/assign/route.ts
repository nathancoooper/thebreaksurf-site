import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpSetValue } from '@/lib/erpnext';

interface AssignEntry { doctype: string; name: string }

// Only Sales Invoice and Purchase Order carry a document-level "project"
// field that's safe to edit after submission. Journal Entry's project field
// lives per accounting line instead, and editing it was found to trip an
// unrelated account-balance validation on submitted entries — so Journal
// Entries are deliberately not supported here yet.
const SUPPORTED_DOCTYPES = new Set(['Sales Invoice', 'Purchase Order']);

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json() as { project?: string; entries?: AssignEntry[] };

  if (!body.project || !Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: 'project and at least one entry are required' }, { status: 400 });
  }

  const unsupported = body.entries.find(e => !SUPPORTED_DOCTYPES.has(e.doctype));
  if (unsupported) {
    return NextResponse.json({ error: `${unsupported.doctype} isn't supported for project tagging yet.` }, { status: 400 });
  }

  for (const entry of body.entries) {
    await erpSetValue(entry.doctype, entry.name, 'project', body.project);
  }

  return NextResponse.json({ ok: true, count: body.entries.length });
}
