import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = promisify(execFile);

// Browsers cannot decode these into an <img>/canvas, so the nesting sheet and
// the design thumbnails would silently drop them. Rasterise with Ghostscript
// on upload and store the PNG alongside the original.
export const VECTOR_EXTS = new Set(['.eps', '.ps', '.ai', '.pdf']);

const BASE_DPI = 300;
const MAX_DPI = 1200;
const MAX_PX = 12000;

export function isVectorFile(filename: string): boolean {
  const ext = filename.includes('.') ? '.' + filename.split('.').pop()!.toLowerCase() : '';
  return VECTOR_EXTS.has(ext);
}

/** PNG stores width/height as big-endian uint32 at bytes 16-23. */
function pngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function ghostscript(input: Buffer, dpi: number): Promise<Buffer | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'raster-'));
  const inPath = path.join(dir, 'input');
  const outPath = path.join(dir, 'output.png');
  try {
    await writeFile(inPath, input);
    await run('gs', [
      '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
      '-sDEVICE=pngalpha',      // transparent background, what DTF wants
      '-dEPSCrop',              // honour the artwork's own bounding box
      '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4',
      `-r${Math.round(dpi)}`,
      `-sOutputFile=${outPath}`,
      inPath,
    ], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    const png = await readFile(outPath);
    return png.length ? png : null;
  } catch (error) {
    console.error('[vectorRaster] ghostscript failed:', error);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Rasterises an EPS/AI/PDF to a transparent PNG at print resolution.
 * When the physical print size is known we scale up so a small bounding box
 * still yields enough pixels for the real print, rather than letting the
 * nesting canvas upscale a low-res bitmap.
 */
export async function rasteriseVector(
  source: Buffer,
  opts: { widthCm?: number; heightCm?: number } = {},
): Promise<Buffer | null> {
  const first = await ghostscript(source, BASE_DPI);
  if (!first) return null;

  const size = pngSize(first);
  const targetW = opts.widthCm && opts.widthCm > 0 ? (opts.widthCm / 2.54) * BASE_DPI : 0;
  if (!size || !size.width || !targetW) return first;

  // DPI that would make the raster match the print size in pixels, bounded by
  // the DPI cap and the maximum pixel width.
  const neededDpi = BASE_DPI * (targetW / size.width);
  const dpi = Math.min(neededDpi, MAX_DPI, (BASE_DPI * MAX_PX) / size.width);
  if (dpi <= BASE_DPI * 1.05) return first;

  const second = await ghostscript(source, dpi);
  return second ?? first;
}
