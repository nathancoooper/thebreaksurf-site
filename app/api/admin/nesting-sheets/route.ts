import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData, writeData } from '@/lib/dataCache';

export interface NestingSheetItem { designId: string; qty: number }
export interface NestingSheet {
  id: string;
  name: string;
  sheetWidthCm: number;
  items: NestingSheetItem[];
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const sheets = await readData<NestingSheet>('nesting_sheets');
  return NextResponse.json(sheets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();

  if (!Array.isArray(body.items) || body.items.length === 0 || !(body.sheetWidthCm > 0)) {
    return NextResponse.json({ error: 'sheetWidthCm and at least one item are required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const sheet: NestingSheet = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: now.slice(0, 10),
    sheetWidthCm: Number(body.sheetWidthCm),
    items: (body.items as NestingSheetItem[]).map(i => ({ designId: i.designId, qty: Number(i.qty) })),
    locked: false,
    createdAt: now,
    updatedAt: now,
  };

  await writeData('nesting_sheets', sheet);
  return NextResponse.json(sheet, { status: 201 });
}
