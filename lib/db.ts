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

// ─── R2 via S3 API (same R2 bucket, reached over HTTPS from the VPS) ─────────

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

let s3: InstanceType<typeof S3Client> | null = null;

function getS3() {
  if (!s3) {
    const accountId = process.env.R2_ACCOUNT_ID ?? '';
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
  }
  return s3;
}

function bucket(): string {
  return process.env.R2_BUCKET_NAME ?? 'thebreaksite-uploads';
}

async function toBytes(value: ReadableStream | ArrayBuffer | string | Buffer): Promise<Uint8Array> {
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  const reader = (value as ReadableStream).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    chunks.push(chunk as Uint8Array);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export function getR2() {
  const client = getS3();
  const bkt = bucket();
  return {
    async get(key: string) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bkt, Key: key }));
        const bytes = await (res.Body as any).transformToByteArray();
        return {
          key,
          size: bytes.length,
          etag: (res.ETag ?? '').replace(/"/g, ''),
          httpMetadata: { contentType: res.ContentType },
          body: new Blob([bytes as unknown as ArrayBuffer]).stream(),
          async arrayBuffer() { return (bytes as Uint8Array).buffer as ArrayBuffer; },
        };
      } catch {
        return null;
      }
    },
    async put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }) {
      const body = await toBytes(value as ReadableStream | ArrayBuffer | string);
      const res = await client.send(new PutObjectCommand({
        Bucket: bkt, Key: key, Body: body,
        ContentType: options?.httpMetadata?.contentType,
      }));
      return { key, size: body.length, etag: (res.ETag ?? '').replace(/"/g, '') };
    },
    async delete(key: string) {
      await client.send(new DeleteObjectCommand({ Bucket: bkt, Key: key }));
    },
    async list(options?: { prefix?: string }) {
      const res = await client.send(new ListObjectsV2Command({ Bucket: bkt, Prefix: options?.prefix }));
      return {
        objects: (res.Contents ?? []).map(o => ({
          key: o.Key ?? '', size: o.Size ?? 0, etag: (o.ETag ?? '').replace(/"/g, ''),
          uploaded: o.LastModified ?? new Date(),
        })),
      };
    },
  };
}
