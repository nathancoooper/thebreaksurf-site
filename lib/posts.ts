import { getDb } from './db';

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  image: string;
  excerpt: string;
  subheading?: string;
  audio?: string;
  author?: string;
}

export interface Post extends PostMeta {
  content: string;
}

export async function getAllPosts(): Promise<PostMeta[]> {
  const db = getDb();
  const rows = await db.prepare('SELECT slug, title, date, image, excerpt FROM posts ORDER BY date DESC')
    .all<{ slug: string; title: string; date: string; image: string; excerpt: string }>();
  return rows.results;
}

export async function getPost(slug: string): Promise<Post | null> {
  const db = getDb();
  const row = await db.prepare('SELECT slug, title, date, image, excerpt, content FROM posts WHERE slug = ?')
    .bind(slug)
    .first<{ slug: string; title: string; date: string; image: string; excerpt: string; content: string }>();
  return row ?? null;
}
