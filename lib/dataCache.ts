import { getDb } from './db';

// D1-backed data reader replacing the old JSON file + mtime cache.
// Each table stores JSON data in a 'data' column keyed by 'id'.

export async function readData<T>(table: string): Promise<T[]> {
  const db = getDb();
  const rows = await db.prepare(`SELECT data FROM ${table}`).all<{ data: string }>();
  return rows.results.map((r: { data: string }) => JSON.parse(r.data) as T);
}

export async function readDataByKey<T>(table: string, key: string): Promise<T | null> {
  const db = getDb();
  const row = await db.prepare(`SELECT data FROM ${table} WHERE id = ?`)
    .bind(key)
    .first<{ data: string }>();
  return row ? JSON.parse(row.data) as T : null;
}

export async function writeData<T extends { id: string }>(table: string, item: T): Promise<void> {
  const db = getDb();
  await db.prepare(
    `INSERT INTO ${table} (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?, updated_at = NOW()`
  )
    .bind(item.id, JSON.stringify(item), JSON.stringify(item))
    .run();
}

export async function deleteData(table: string, id: string): Promise<void> {
  const db = getDb();
  await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
}

// For settings-style tables (key-value store)
export async function readSetting<T>(table: string, key: string): Promise<T | null> {
  const db = getDb();
  const row = await db.prepare(`SELECT value FROM ${table} WHERE \`key\` = ?`)
    .bind(key)
    .first<{ value: string }>();
  return row ? JSON.parse(row.value) as T : null;
}

export async function writeSetting(table: string, key: string, value: unknown): Promise<void> {
  const db = getDb();
  await db.prepare(
    `INSERT INTO ${table} (\`key\`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`
  )
    .bind(key, JSON.stringify(value), JSON.stringify(value))
    .run();
}
