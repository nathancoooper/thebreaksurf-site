import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SocialPost } from '@/types';

const DATA_FILE = path.join(process.cwd(), 'data/social.json');

async function read(): Promise<SocialPost[]> {
  return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
}

async function write(posts: SocialPost[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(posts, null, 2), 'utf8');
}

// Silently remove an upload-path like "/images/uploads/foo.jpg" from disk.
// Only removes files under public/images/uploads/ to prevent path traversal.
async function removeUploadFile(publicPath: string | undefined) {
  if (!publicPath) return;
  const rel = publicPath.replace(/^\//, '');
  if (!rel.startsWith('images/uploads/')) return;
  const abs = path.join(process.cwd(), 'public', rel);
  await fs.unlink(abs).catch(() => {});
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const patch = await req.json();
  const posts = await read();
  const idx = posts.findIndex(p => p.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const old = posts[idx];

  // Remove old files if they've been replaced with a different path
  if (patch.fileUrl !== undefined && patch.fileUrl !== old.fileUrl) {
    await removeUploadFile(old.fileUrl);
  }
  if (patch.thumbnailUrl !== undefined && patch.thumbnailUrl !== old.thumbnailUrl) {
    await removeUploadFile(old.thumbnailUrl);
  }

  posts[idx] = { ...old, ...patch };
  await write(posts);
  return NextResponse.json(posts[idx]);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;
  const posts = await read();
  const post = posts.find(p => p.id === id);
  if (post) {
    await Promise.all([
      removeUploadFile(post.fileUrl),
      removeUploadFile(post.thumbnailUrl),
    ]);
  }
  await write(posts.filter(p => p.id !== id));
  return NextResponse.json({ ok: true });
}
