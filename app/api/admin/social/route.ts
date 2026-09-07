import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SocialPost } from '@/types';

const FILE = path.join(process.cwd(), 'data/social.json');

async function read(): Promise<SocialPost[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function write(posts: SocialPost[]) {
  await fs.writeFile(FILE, JSON.stringify(posts, null, 2), 'utf8');
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const posts = await read();
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const post: SocialPost = await req.json();
  if (!post.id || !post.title) return NextResponse.json({ error: 'id and title required' }, { status: 400 });
  const posts = await read();
  posts.unshift(post);
  await write(posts);
  return NextResponse.json(post, { status: 201 });
}
