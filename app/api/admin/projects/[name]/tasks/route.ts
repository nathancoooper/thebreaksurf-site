import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpCreate } from '@/lib/erpnext';

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;

  const tasks = await erpList('Task', {
    fields: ['name', 'subject', 'status', 'priority', 'description'],
    filters: [['project', '=', name]],
    orderBy: 'creation desc',
    limit: 200,
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;
  const body = await req.json() as { subject?: string; priority?: string; description?: string };

  if (!body.subject?.trim()) {
    return NextResponse.json({ error: 'subject is required' }, { status: 400 });
  }

  const task = await erpCreate('Task', {
    project: name,
    subject: body.subject.trim(),
    status: 'Open',
    priority: body.priority ?? 'Medium',
    description: body.description ?? '',
  });

  return NextResponse.json(task);
}
