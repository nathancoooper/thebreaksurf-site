import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData, writeData, deleteData } from '@/lib/dataCache';
import type { NestingSheet, NestingSheetItem } from '../route';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const body = await req.json();

  const sheets = await readData<NestingSheet>('nesting_sheets');
  const existing = sheets.find(s => s.id === id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isLockToggle = typeof body.locked === 'boolean' && body.items === undefined && body.sheetWidthCm === undefined;
  if (isLockToggle) {
    await writeData('nesting_sheets', { ...existing, locked: body.locked, updatedAt: new Date().toISOString() });
    return NextResponse.json({ ...existing, locked: body.locked, updatedAt: new Date().toISOString() });
  }

  if (existing.locked) {
    return NextResponse.json({ error: 'This sheet is locked — unlock it first.' }, { status: 423 });
  }

  const updated: NestingSheet = {
    ...existing,
    sheetWidthCm: body.sheetWidthCm > 0 ? Number(body.sheetWidthCm) : existing.sheetWidthCm,
    items: Array.isArray(body.items) && body.items.length > 0
      ? (body.items as NestingSheetItem[]).map(i => ({ designId: i.designId, qty: Number(i.qty) }))
      : existing.items,
    updatedAt: new Date().toISOString(),
  };

  await writeData('nesting_sheets', updated);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const sheets = await readData<NestingSheet>('nesting_sheets');
  if (!sheets.some(s => s.id === id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await deleteData('nesting_sheets', id);
  return NextResponse.json({ ok: true });
}
