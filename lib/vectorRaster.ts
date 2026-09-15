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
// Ink is measured on a downscaled copy, so the crop is padded by the scale
// factor: that way measurement error can only ever add margin, never clip
// artwork.
const MEASURE_EDGE = 2048;
// Image sent to the dialog; the reported width/height stay the true ones.
const PREVIEW_EDGE = 320;

// Rasters that can carry real transparency. JPEG has none (nothing to trim)
// and GIF is usually animation, where cropping would discard frames.
export const TRIMMABLE_RASTER_EXTS = new Set(['.png', '.webp', '.avif', '.tif', '.tiff', '.bmp']);

export function fileExt(filename: string): string {
  return filename.includes('.') ? '.' + filename.split('.').pop()!.toLowerCase() : '';
}

export function isTrimmableRaster(filename: string): boolean {
  const ext = fileExt(filename);
  return !VECTOR_EXTS.has(ext) && TRIMMABLE_RASTER_EXTS.has(ext);
}

export function isVectorFile(filename: string): boolean {
  const ext = filename.includes('.') ? '.' + filename.split('.').pop()!.toLowerCase() : '';
  return VECTOR_EXTS.has(ext);
}

/** PNG stores width/height as big-endian uint32 at bytes 16-23. */
export function pngSize(buf: Buffer): { width: number; height: number } | null {
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
      '-dEPSCrop',              // honour the artwork's own artboard
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

interface Box { x: number; y: number; width: number; height: number }

/**
 * Finds the artwork's real extent inside the artboard by reading the alpha
 * channel, so blank margins can be cropped away. Returns null when the file
 * can't be measured (in which case the untrimmed raster is used).
 */
async function inkBox(png: Buffer, width: number, height: number, pad = true): Promise<Box | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'measure-'));
  const inPath = path.join(dir, 'in.png');
  try {
    await writeFile(inPath, png);
    const scale = width > MEASURE_EDGE ? Math.round(MEASURE_EDGE) : 0;
    const args = ['-v', 'error', '-i', inPath];
    if (scale) args.push('-vf', `scale=${scale}:-1`);
    args.push('-f', 'rawvideo', '-pix_fmt', 'rgba', '-');
    const { stdout } = await run('ffmpeg', args, { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 120_000 });

    const sw = scale || width;
    const sh = Math.floor(stdout.length / (sw * 4));
    if (!sh) return null;

    let sx0 = sw, sy0 = sh, sx1 = -1, sy1 = -1;
    for (let y = 0; y < sh; y++) {
      const row = y * sw * 4;
      for (let x = 0; x < sw; x++) {
        if (stdout[row + x * 4 + 3] > 8) {
          if (x < sx0) sx0 = x;
          if (x > sx1) sx1 = x;
          if (y < sy0) sy0 = y;
          if (y > sy1) sy1 = y;
        }
      }
    }
    if (sx1 < 0) return null; // fully transparent

    const toFullX = (v: number) => Math.round((v / sw) * width);
    const toFullY = (v: number) => Math.round((v / sh) * height);
    // Pad by one measure-pixel so rounding can't shave the artwork: that is
    // the measurement's own error, and keeping it tight matters for short
    // artwork, where a few pixels are a large share of the height. Previews
    // skip it entirely - there the ratio matters more than a pixel or two.
    const margin = pad ? Math.ceil(width / sw) + 1 : 0;

    const box: Box = {
      x: Math.max(0, toFullX(sx0) - margin),
      y: Math.max(0, toFullY(sy0) - margin),
      width: 0,
      height: 0,
    };
    box.width = Math.min(width - box.x, toFullX(sx1) - box.x + 1 + margin);
    box.height = Math.min(height - box.y, toFullY(sy1) - box.y + 1 + margin);
    if (box.width < 1 || box.height < 1) return null;
    return box;
  } catch (error) {
    console.error('[vectorRaster] ink measurement failed:', error);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function cropPng(png: Buffer, box: Box): Promise<Buffer | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'crop-'));
  const inPath = path.join(dir, 'in.png');
  const outPath = path.join(dir, 'out.png');
  try {
    await writeFile(inPath, png);
    await run('ffmpeg', [
      '-v', 'error', '-i', inPath,
      '-vf', `crop=${box.width}:${box.height}:${box.x}:${box.y}`,
      '-frames:v', '1', '-y', outPath,
    ], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    const out = await readFile(outPath);
    return out.length ? out : null;
  } catch (error) {
    console.error('[vectorRaster] crop failed:', error);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Crops the blank artboard margins, falling back to the original raster. */
export async function trimToArtwork(png: Buffer, opts: { pad?: boolean } = {}): Promise<{ png: Buffer; width: number; height: number } | null> {
  const size = pngSize(png);
  if (!size) return null;
  const box = await inkBox(png, size.width, size.height, opts.pad !== false);
  if (!box || (box.width >= size.width && box.height >= size.height)) {
    return { png, width: size.width, height: size.height };
  }
  const cropped = await cropPng(png, box);
  if (!cropped) return { png, width: size.width, height: size.height };
  const croppedSize = pngSize(cropped);
  return { png: cropped, width: croppedSize?.width ?? size.width, height: croppedSize?.height ?? size.height };
}

/**
 * Rasterises an EPS/AI/PDF to a transparent, margin-trimmed PNG at print
 * resolution. When the print size is known the raster is scaled so the
 * *artwork* (not the artboard) matches it, which is what the size really means
 * to whoever is printing it.
 */
export async function rasteriseVector(
  source: Buffer,
  opts: { widthCm?: number; heightCm?: number } = {},
): Promise<Buffer | null> {
  const first = await ghostscript(source, BASE_DPI);
  if (!first) return null;

  const firstSize = pngSize(first);
  const box = firstSize ? await inkBox(first, firstSize.width, firstSize.height) : null;

  // Work out whether the artwork has enough pixels for the requested print
  // width once the margins are gone, and re-render at a higher DPI if not.
  let raster = first;
  if (firstSize && box && opts.widthCm && opts.widthCm > 0) {
    const targetW = (opts.widthCm / 2.54) * BASE_DPI;
    const neededDpi = BASE_DPI * (targetW / box.width);
    const dpi = Math.min(neededDpi, MAX_DPI, (BASE_DPI * MAX_PX) / box.width);
    if (dpi > BASE_DPI * 1.05) {
      const second = await ghostscript(source, dpi);
      if (second) raster = second;
    }
  }

  const trimmed = await trimToArtwork(raster);
  return trimmed?.png ?? raster;
}

async function scalePng(png: Buffer, maxEdge: number): Promise<Buffer | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'scale-'));
  const inPath = path.join(dir, 'in.png');
  const outPath = path.join(dir, 'out.png');
  try {
    await writeFile(inPath, png);
    await run('ffmpeg', [
      '-v', 'error', '-i', inPath,
      '-vf', `scale='min(${maxEdge},iw)':-1`,
      '-frames:v', '1', '-y', outPath,
    ], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    const out = await readFile(outPath);
    return out.length ? out : null;
  } catch (error) {
    console.error('[vectorRaster] scale failed:', error);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Low-resolution raster used to preview vector artwork and to learn the
 * artwork's proportions while the dialog is still open — the browser cannot
 * decode EPS/AI/PDF itself, so without this neither the preview nor the
 * dimension auto-fill is possible. Trimmed for the same reason as the full
 * raster: the proportions must match what actually gets printed.
 */
export async function rasteriseVectorPreview(source: Buffer, dpi = 150): Promise<{ png: Buffer; width: number; height: number } | null> {
  const png = await ghostscript(source, dpi);
  if (!png) return null;
  // Unpadded, so the reported proportions track the artwork rather than the
  // crop's safety margin - the dialog fills one print dimension from this.
  const trimmed = await trimToArtwork(png, { pad: false });
  if (!trimmed) return null;
  const small = trimmed.width > PREVIEW_EDGE ? await scalePng(trimmed.png, PREVIEW_EDGE) : null;
  return { png: small ?? trimmed.png, width: trimmed.width, height: trimmed.height };
}

async function toPng(source: Buffer, alreadyPng: boolean): Promise<Buffer | null> {
  if (alreadyPng) return source;
  const dir = await mkdtemp(path.join(tmpdir(), 'topng-'));
  const inPath = path.join(dir, 'in');
  const outPath = path.join(dir, 'out.png');
  try {
    await writeFile(inPath, source);
    await run('ffmpeg', ['-v', 'error', '-i', inPath, '-frames:v', '1', '-y', outPath], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    const png = await readFile(outPath);
    return png.length ? png : null;
  } catch (error) {
    console.error('[vectorRaster] transcode failed:', error);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Trims blank margins from an uploaded raster. Only does anything when the
 * image carries real transparency *and* the artwork doesn't reach the edges -
 * a fully opaque image (or a JPEG flattened to one) fills the canvas, so it is
 * left exactly as uploaded. Returns null when nothing should change.
 */
export async function trimRasterUpload(source: Buffer): Promise<{ png: Buffer; width: number; height: number } | null> {
  const png = await toPng(source, pngSize(source) !== null);
  if (!png) return null;
  const size = pngSize(png);
  if (!size) return null;

  const box = await inkBox(png, size.width, size.height);
  if (!box) return null;
  if (box.width >= size.width && box.height >= size.height) return null;

  const cropped = await cropPng(png, box);
  if (!cropped) return null;
  const croppedSize = pngSize(cropped);
  if (!croppedSize) return null;
  return { png: cropped, width: croppedSize.width, height: croppedSize.height };
}
