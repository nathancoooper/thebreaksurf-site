import { getR2 } from './db';

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

/**
 * Upload a file to R2
 */
export async function uploadToR2(
  key: string,
  content: ReadableStream | ArrayBuffer | Buffer | string,
  contentType?: string,
): Promise<R2UploadResult> {
  const r2 = getR2();
  // Convert Buffer to ArrayBuffer if needed
  const data = content instanceof Buffer ? new Uint8Array(content).buffer as ArrayBuffer : content;
  const result = await r2.put(key, data as any, {
    httpMetadata: contentType ? { contentType } : undefined,
  });
  return {
    key: result.key,
    size: result.size,
    etag: result.etag,
  };
}

/**
 * Download a file from R2
 */
export async function downloadFromR2(key: string): Promise<{ content: ArrayBuffer; contentType: string } | null> {
  const r2 = getR2();
  const object = await r2.get(key);
  if (!object) return null;
  
  const content = await object.arrayBuffer();
  const contentType = (object as any).httpMetadata?.contentType ?? 'application/octet-stream';
  return { content, contentType };
}

/**
 * Get a file from R2 as a readable stream
 */
export async function getR2Stream(key: string): Promise<ReadableStream | null> {
  const r2 = getR2();
  const object = await r2.get(key);
  if (!object) return null;
  return (object as any).body;
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const r2 = getR2();
  await r2.delete(key);
}

/**
 * List files in R2 with a prefix
 */
export async function listR2Files(prefix: string): Promise<R2File[]> {
  const r2 = getR2();
  const listed = await r2.list({ prefix });
  return (listed as any).objects.map((obj: any) => ({
    key: obj.key,
    size: obj.size,
    etag: obj.etag,
    uploaded: obj.uploaded,
  }));
}

/**
 * Check if a file exists in R2
 */
export async function r2FileExists(key: string): Promise<boolean> {
  const r2 = getR2();
  const object = await r2.get(key);
  return object !== null;
}

/**
 * Generate a presigned URL for temporary access (not supported in Workers R2, use direct access)
 */
export function getR2PublicUrl(key: string): string {
  // In Cloudflare Workers, R2 objects can be accessed via the Workers URL
  // This assumes the worker is configured to serve R2 objects
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
