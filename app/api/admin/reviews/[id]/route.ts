import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { getDb } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const { status } = await request.json();
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const db = getDb();
  const result = await db.prepare(
    'UPDATE reviews SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(status, id).run();
  if (result.meta.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const db = getDb();
  const result = await db.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}