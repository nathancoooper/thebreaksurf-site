import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData, writeData } from '@/lib/dataCache';

export interface Design {
  id: string;
  garmentName: string;
  printType: string;
  color: string;
  imagePath: string;
  widthCm: number;
  heightCm: number;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  return NextResponse.json(await readData<Design>('designs'));
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();

  if (!body.garmentName?.trim() || !body.printType?.trim() || !body.color?.trim() || !body.imagePath || !body.widthCm || !body.heightCm) {
    return NextResponse.json({ error: 'garmentName, printType, color, imagePath, widthCm and heightCm are required' }, { status: 400 });
  }

  const design: Design = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    garmentName: body.garmentName.trim(),
    printType: body.printType.trim(),
    color: body.color.trim(),
    imagePath: body.imagePath,
    widthCm: Number(body.widthCm),
    heightCm: Number(body.heightCm),
    createdAt: new Date().toISOString(),
  };

  await writeData('designs', design);
  return NextResponse.json(design, { status: 201 });
}
