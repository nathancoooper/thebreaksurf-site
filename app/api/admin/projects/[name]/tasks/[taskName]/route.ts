import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpSetValue } from '@/lib/erpnext';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ name: string; taskName: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { taskName } = await params;
  const body = await req.json() as { status?: string; subject?: string; priority?: string };

  if (typeof body.status === 'string') {
    await erpSetValue('Task', taskName, 'status', body.status);
  }
  if (typeof body.subject === 'string') {
    await erpSetValue('Task', taskName, 'subject', body.subject);
  }
  if (typeof body.priority === 'string') {
    await erpSetValue('Task', taskName, 'priority', body.priority);
  }

  return NextResponse.json({ ok: true });
}
