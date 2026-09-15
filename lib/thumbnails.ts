import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = promisify(execFile);

// Design artwork is often many megabytes, which is far more than a grid card
// needs — the cards were downloading the full file (12 MB in one case) just to
// draw it at 176px wide.
const THUMB_EDGE = 320;

const WEBP_QUALITY = 82;

export interface Thumbnail {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

async function encode(source: Buffer, outPath: string, maxEdge: number, codec: string[]): Promise<Buffer | null> {
  const dir = path.dirname(outPath);
  const inPath = path.join(dir, 'in');
  await writeFile(inPath, source);
  await run('ffmpeg', [
    '-v', 'error',
    '-i', inPath,
    // Comma must be backslash-escaped: ffmpeg's filtergraph parser otherwise
    // reads it as a filter separator. Passing it as a single argv element
    // means there is no shell to strip quoting for us.
    '-vf', `scale=min(${maxEdge}\\,iw):-1`,
    ...codec,
    '-frames:v', '1',
    '-y', outPath,
  ], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  const out = await readFile(outPath);
  return out.length ? out : null;
}

/**
 * Small preview of uploaded artwork. WebP first (roughly a quarter the size of
 * PNG here, and it keeps the alpha channel DTF artwork depends on), falling
 * back to PNG if this build of ffmpeg can't encode WebP.
 *
 * Returns null when no thumbnail can be made — notably SVG, which ffmpeg has
 * no decoder for; the caller keeps using the original, which is vector and
 * therefore tiny anyway.
 */
export async function makeThumbnail(source: Buffer, maxEdge = THUMB_EDGE): Promise<Thumbnail | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'thumb-'));
  try {
    const webp = await encode(source, path.join(dir, 'out.webp'), maxEdge, ['-c:v', 'libwebp', '-quality', String(WEBP_QUALITY)])
      .catch(error => { console.error('[thumbnails] webp encode failed:', error); return null; });
    if (webp) return { buffer: webp, contentType: 'image/webp', extension: '.webp' };

    const png = await encode(source, path.join(dir, 'out.png'), maxEdge, [])
      .catch(error => { console.error('[thumbnails] png encode failed:', error); return null; });
    if (png) return { buffer: png, contentType: 'image/png', extension: '.png' };

    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
