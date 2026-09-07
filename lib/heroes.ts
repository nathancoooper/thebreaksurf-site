import { getDb } from './db';

export interface Hero {
  id: string;
  title: string;
  label: string;
  heading: string;
  buttonText: string;
  buttonHref: string;
  image: string;
}

export async function getHeroes(): Promise<Hero[]> {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM heroes').all<{ data: string }>();
  return rows.results.map((r: { data: string }) => JSON.parse(r.data) as Hero);
}

export async function getHero(id: string): Promise<Hero | undefined> {
  const db = getDb();
  const row = await db.prepare('SELECT data FROM heroes WHERE id = ?')
    .bind(id)
    .first<{ data: string }>();
  return row ? JSON.parse(row.data) as Hero : undefined;
}

export async function saveHero(id: string, updates: Partial<Hero>): Promise<Hero> {
  const existing = await getHero(id);
  if (!existing) throw new Error(`Hero "${id}" not found`);
  const updated = { ...existing, ...updates };
  const db = getDb();
  await db.prepare(
    'INSERT INTO heroes (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = ?, updated_at = datetime(\'now\')'
  )
    .bind(id, JSON.stringify(updated), JSON.stringify(updated))
    .run();
  return updated;
}
