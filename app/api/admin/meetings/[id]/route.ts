import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData, writeData, deleteData } from '@/lib/dataCache';
import type { Meeting } from '../route';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const meetings = await readData<Meeting>('meetings');
  const meeting = meetings.find(m => m.id === id);
  if (!meeting) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(meeting);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const body = await req.json();
  const meetings = await readData<Meeting>('meetings');
  const existing = meetings.find(m => m.id === id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const updated = { ...existing, ...body, id, updatedAt: new Date().toISOString() };
  await writeData('meetings', updated);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const meetings = await readData<Meeting>('meetings');
  if (!meetings.some(m => m.id === id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await deleteData('meetings', id);
  return NextResponse.json({ ok: true });
}
