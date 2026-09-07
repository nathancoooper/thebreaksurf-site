import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Review } from '@/types';

const FILE = path.join(process.cwd(), 'data', 'reviews.json');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const raw = await readFile(FILE, 'utf8');
  const all: Review[] = JSON.parse(raw);
  const approved = all
    .filter(r => r.productId === productId && r.status === 'approved')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return NextResponse.json(approved);
}
