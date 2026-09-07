import mysql from 'mysql2/promise';

// MariaDB adapter. Keeps the old D1-shaped interface (prepare/bind/first/
// all/run with `?` placeholders) so no call sites had to change — only the
// SQL dialect in a handful of queries (ON DUPLICATE KEY UPDATE instead of
// ON CONFLICT, NOW() instead of datetime('now'), no rowid).

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  first<T>(colName?: string): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

let pool: ReturnType<typeof mysql.createPool> | null = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST ?? 'db',
      user: process.env.DB_USER ?? 'tbs',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'thebreaksite',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

class MariaStatement implements D1PreparedStatement {
  private params: unknown[] = [];
  constructor(private query: string) {}
  bind(...params: unknown[]): D1PreparedStatement {
    this.params = params;
    return this;
  }
  async first<T>(): Promise<T | null> {
    const [rows] = await getPool().execute(this.query, this.params as any[]);
    const list = rows as T[];
    return list.length > 0 ? list[0] : null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    const [rows] = await getPool().execute(this.query, this.params as any[]);
    return { results: rows as T[] };
  }
  async run(): Promise<{ meta: { changes: number } }> {
    const [result] = await getPool().execute(this.query, this.params as any[]);
    const info = result as { affectedRows?: number };
    return { meta: { changes: info.affectedRows ?? 0 } };
  }
}

export function getDb(): D1Database {
  return {
    prepare: (query: string) => new MariaStatement(query),
  };
}

// NOTE: file blobs live on the VPS volume (see lib/r2.ts). This module is
// strictly the MariaDB adapter. No Cloudflare bindings or SDKs here.
