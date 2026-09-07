import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Review } from '@/types';

const FILE = path.join(process.cwd(), 'data', 'reviews.json');

async function load(): Promise<Review[]> {
  const raw = await readFile(FILE, 'utf8');
  return JSON.parse(raw);
}

async function save(reviews: Review[]) {
  await writeFile(FILE, JSON.stringify(reviews, null, 2));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { productId, name, rating, body: text } = body;

  if (!productId || !name || !rating || !text) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (rating < 0.5 || rating > 5 || rating % 0.5 !== 0) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
  }

  const review: Review = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId,
    name: String(name).trim().slice(0, 80),
    rating,
    body: String(text).trim().slice(0, 2000),
    status: 'pending',
    date: new Date().toISOString(),
  };

  const reviews = await load();
  reviews.push(review);
  await save(reviews);

  return NextResponse.json({ ok: true });
}
