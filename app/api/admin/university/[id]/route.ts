import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { updateSubmission, deleteSubmission } from '@/lib/universitySubmissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const { completed } = await request.json();
  if (typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'Invalid completed value' }, { status: 400 });
  }
  let updated;
  try {
    updated = await updateSubmission(id, completed);
  } catch {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  let deleted;
  try {
    deleted = await deleteSubmission(id);
  } catch {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
