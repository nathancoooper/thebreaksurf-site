import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { getDb } from '@/lib/db';
import { Review } from '@/types';

export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  // The reviews table uses explicit columns (not the JSON `data` column
  // that products/events/heroes use), so query them directly.
  const db = getDb();
  const rows = await db.prepare(
    'SELECT id, product_id, name, rating, body, status, date FROM reviews'
  ).all<Review>();
  const reviews = rows.results;
  reviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return NextResponse.json(reviews);
}