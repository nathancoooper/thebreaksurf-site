import { mkdir, readFile, writeFile, unlink, access, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Filesystem blob store (VPS volumes). Same function names/signatures as the
// old R2-backed version, so no call sites changed. Keys map 1:1 to files
// under BLOBS_DIR (default /app/data/blobs, persisted in the tbs_data
// volume). No Cloudflare involved.

export interface R2UploadResult {
  key: string;
  size: number;
  etag: string;
}

export interface R2File {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
}

function baseDir(): string {
  return process.env.BLOBS_DIR ?? '/app/data/blobs';
}

function filePath(key: string): string {
  const p = path.normalize('/' + key).slice(1);
  return path.join(baseDir(), p);
}

function etagOf(buf: Buffer): string {
  return createHash('md5').update(buf).digest('hex');
}

/**
 * Upload a file to the blob store
 */
export async function uploadToR2(
  key: string,
  content: ReadableStream | ArrayBuffer | Buffer | string,
  contentType?: string,
): Promise<R2UploadResult> {
  const fp = filePath(key);
  await mkdir(path.dirname(fp), { recursive: true });
  let buf: Buffer;
  if (typeof content === 'string') buf = Buffer.from(content);
  else if (Buffer.isBuffer(content)) buf = content;
  else if (content instanceof ArrayBuffer) buf = Buffer.from(content);
  else {
    const reader = (content as ReadableStream).getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value as Uint8Array);
    }
    buf = Buffer.concat(chunks);
  }
  await writeFile(fp, buf);
  void contentType;
  return {
    key,
    size: buf.length,
    etag: etagOf(buf),
  };
}

/**
 * Download a file from the blob store
 */
export async function downloadFromR2(key: string): Promise<{ content: ArrayBuffer; contentType: string } | null> {
  try {
    const buf = await readFile(filePath(key));
    const content = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return { content, contentType: getContentType(key.split('.').pop()?.toLowerCase() ?? '') };
  } catch {
    return null;
  }
}

/**
 * Get a file from the blob store as a readable stream
 */
export async function getR2Stream(key: string): Promise<ReadableStream | null> {
  try {
    await access(filePath(key));
  } catch {
    return null;
  }
  return Readable.toWeb(createReadStream(filePath(key))) as unknown as ReadableStream;
}

/**
 * Delete a file from the blob store
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    await unlink(filePath(key));
  } catch { /* already gone */ }
}

/**
 * List files in the blob store with a prefix
 */
export async function listR2Files(prefix: string): Promise<R2File[]> {
  const out: R2File[] = [];
  async function walk(dir: string, rel: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(path.join(dir, e.name), relPath);
      } else if (relPath.startsWith(prefix)) {
        const st = await stat(path.join(dir, e.name));
        out.push({ key: relPath, size: st.size, etag: '', uploaded: st.mtime });
      }
    }
  }
  await walk(baseDir(), '');
  return out;
}

/**
 * Check if a file exists in the blob store
 */
export async function r2FileExists(key: string): Promise<boolean> {
  try {
    await access(filePath(key));
    return true;
  } catch {
    return false;
  }
}

/**
 * Public URL for a blob (served by /api/r2/[...path])
 */
export function getR2PublicUrl(key: string): string {
  return `/api/r2/${encodeURIComponent(key)}`;
}

/**
 * Upload an image with proper content type detection
 */
export async function uploadImage(
  prefix: string,
  filename: string,
  content: Buffer,
  originalContentType?: string,
): Promise<R2UploadResult> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const contentType = originalContentType ?? getContentType(ext);
  const key = `${prefix}/${filename}`;
  return uploadToR2(key, content, contentType);
}

/**
 * Get content type from file extension
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'zip': 'application/zip',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
  };
  return types[ext] ?? 'application/octet-stream';
}
