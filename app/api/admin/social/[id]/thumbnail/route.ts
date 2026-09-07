import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData, writeData } from '@/lib/dataCache';
import type { SocialPost } from '@/types';

// Video thumbnail generation has been removed for Cloudflare migration
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { id } = await params;

  const posts = await readData<SocialPost>('social_posts');
  const post = posts.find(p => p.id === id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (post.type !== 'video' || !post.fileUrl) {
    return NextResponse.json({ error: 'Post has no video file' }, { status: 400 });
  }

  // Video thumbnail generation is not supported on Cloudflare
  return NextResponse.json({ error: 'Video thumbnail generation not supported on Cloudflare' }, { status: 400 });
}
