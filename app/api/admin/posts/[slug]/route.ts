import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { getPost } from '@/lib/posts';
import { recordSlugRename } from '@/lib/postRedirects';
import { revalidatePath } from 'next/cache';
import { purgeAndWarm } from '@/lib/cloudflareCache';
import { getDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(post);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { slug: oldSlug } = await params;
  const { slug: newSlugRaw, title, date, excerpt, image, subheading, audio, author, content } = await request.json();

  const newSlug = (newSlugRaw || oldSlug).trim();
  if (!newSlug) {
    return NextResponse.json({ error: 'Slug cannot be empty' }, { status: 400 });
  }

  const db = getDb();

  if (newSlug !== oldSlug) {
    const existing = await db.prepare('SELECT slug FROM posts WHERE slug = ?').bind(newSlug).first();
    if (existing) {
      return NextResponse.json({ error: 'A post with that slug already exists' }, { status: 409 });
    }
    // Insert new slug, delete old
    await db.prepare(
      'INSERT INTO posts (slug, title, date, image, excerpt, content) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(newSlug, title, date, image ?? '', excerpt ?? '', content ?? '').run();
    await db.prepare('DELETE FROM posts WHERE slug = ?').bind(oldSlug).run();
    await recordSlugRename(oldSlug, newSlug);
    revalidatePath(`/writing/${oldSlug}`);
  } else {
    await db.prepare(
      'UPDATE posts SET title = ?, date = ?, image = ?, excerpt = ?, content = ?, updated_at = datetime(\'now\') WHERE slug = ?'
    ).bind(title, date, image ?? '', excerpt ?? '', content ?? '', oldSlug).run();
  }

  revalidatePath('/');
  revalidatePath('/writing');
  revalidatePath(`/writing/${newSlug}`);
  const paths = ['/', '/writing', `/writing/${newSlug}`];
  if (newSlug !== oldSlug) paths.push(`/writing/${oldSlug}`);
  purgeAndWarm(paths).catch(() => {});

  return NextResponse.json({ ok: true, slug: newSlug });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { slug } = await params;

  const db = getDb();
  const result = await db.prepare('DELETE FROM posts WHERE slug = ?').bind(slug).run();
  if (result.meta.changes === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  revalidatePath('/');
  revalidatePath('/writing');
  revalidatePath(`/writing/${slug}`);
  purgeAndWarm(['/', '/writing', `/writing/${slug}`]).catch(() => {});
  return NextResponse.json({ ok: true });
}
