import { getDb } from './db';

export async function recordSlugRename(oldSlug: string, newSlug: string) {
  const db = getDb();
  // Update any existing redirects pointing to oldSlug
  await db.prepare('UPDATE post_redirects SET new_slug = ? WHERE new_slug = ?')
    .bind(newSlug, oldSlug)
    .run();
  // Add the new redirect
  await db.prepare(
    'INSERT INTO post_redirects (old_slug, new_slug) VALUES (?, ?) ON CONFLICT(old_slug) DO UPDATE SET new_slug = ?'
  )
    .bind(oldSlug, newSlug, newSlug)
    .run();
}

export async function resolvePostRedirect(slug: string): Promise<string | null> {
  const db = getDb();
  let current = slug;
  const seen = new Set<string>();
  while (true) {
    const row = await db.prepare('SELECT new_slug FROM post_redirects WHERE old_slug = ?')
      .bind(current)
      .first<{ new_slug: string }>();
    if (!row || seen.has(current)) break;
    seen.add(current);
    current = row.new_slug;
  }
  return current !== slug ? current : null;
}
