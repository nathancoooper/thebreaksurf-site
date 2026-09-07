// Seed MariaDB from db/seed/*.json (dumped from D1).
// Usage: DB_HOST=127.0.0.1 DB_USER=tbs DB_PASSWORD=... DB_NAME=thebreaksite node db/seed.mjs
// Safe to re-run — every statement is an upsert.
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  user: process.env.DB_USER ?? 'tbs',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'thebreaksite',
});

async function load(name) {
  return JSON.parse(await readFile(new URL(`./seed/${name}.json`, import.meta.url), 'utf8'));
}

let n = 0;
for (const t of ['products', 'events', 'heroes']) {
  for (const r of await load(t)) {
    await db.execute(
      `INSERT INTO ${t} (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [r.id, r.data],
    );
    n++;
  }
}
for (const r of await load('posts')) {
  await db.execute(
    'INSERT INTO posts (slug, title, date, image, excerpt, content) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), date = VALUES(date), image = VALUES(image), excerpt = VALUES(excerpt), content = VALUES(content)',
    [r.slug, r.title, r.date, r.image, r.excerpt, r.content],
  );
  n++;
}
for (const t of ['settings', 'stock_snapshot']) {
  for (const r of await load(t)) {
    await db.execute(
      `INSERT INTO ${t} (\`key\`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [r.key, r.value],
    );
    n++;
  }
}
// Admin users (bcrypt hashes carry over untouched).
for (const r of await load('users')) {
  await db.execute(
    'INSERT INTO users (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
    [r.id, r.data],
  );
  n++;
}

await db.end();
console.log(`seeded ${n} rows`);
