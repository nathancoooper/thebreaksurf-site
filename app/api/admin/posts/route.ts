import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { getAllPosts } from '@/lib/posts';
import { revalidatePath } from 'next/cache';
import { purgeAndWarm } from '@/lib/cloudflareCache';
import { writeData } from '@/lib/dataCache';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  return NextResponse.json(await getAllPosts());
}

export async function POST(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  const { slug, title, date, excerpt, image, subheading, audio, author, content } = await request.json();

  if (!slug || !title) {
    return NextResponse.json({ error: 'slug and title are required' }, { status: 400 });
  }

  const db = getDb();
  const existing = await db.prepare('SELECT slug FROM posts WHERE slug = ?').bind(slug).first();
  if (existing) {
    return NextResponse.json({ error: 'A post with that slug already exists' }, { status: 409 });
  }

  await db.prepare(
    'INSERT INTO posts (slug, title, date, image, excerpt, content) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(slug, title, date, image ?? '', excerpt ?? '', content ?? '').run();

  revalidatePath('/');
  revalidatePath('/writing');
  purgeAndWarm(['/', '/writing', `/writing/${slug}`]).catch(() => {});

  return NextResponse.json({ ok: true, slug });
}
