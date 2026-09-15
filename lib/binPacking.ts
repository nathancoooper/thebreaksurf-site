export interface PackItem {
  id: string;
  widthCm: number;
  heightCm: number;
}

export interface PlacedItem extends PackItem {
  x: number;
  y: number;
  /** True when the piece was turned 90° to fit. widthCm/heightCm always stay
   *  the artwork's own dimensions; the footprint is the swapped pair. */
  rotated?: boolean;
}

/** Footprint of a placement on the sheet (swapped when rotated). */
export function footprint(item: { widthCm: number; heightCm: number; rotated?: boolean }): { widthCm: number; heightCm: number } {
  return item.rotated
    ? { widthCm: item.heightCm, heightCm: item.widthCm }
    : { widthCm: item.widthCm, heightCm: item.heightCm };
}

export interface PackResult {
  placed: PlacedItem[];
  sheetWidthCm: number;
  sheetHeightCm: number;
}

interface Rect { x: number; y: number; width: number; height: number }

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Splits a free rectangle around a rectangle that's just been placed inside
// it, into up to 4 leftover free rectangles (the parts of `free` not
// covered by `placed`) — standard guillotine split.
function splitFreeRect(free: Rect, placed: Rect): Rect[] {
  if (!rectsOverlap(free, placed)) return [free];
  const out: Rect[] = [];
  if (placed.x > free.x) {
    out.push({ x: free.x, y: free.y, width: placed.x - free.x, height: free.height });
  }
  if (placed.x + placed.width < free.x + free.width) {
    out.push({ x: placed.x + placed.width, y: free.y, width: (free.x + free.width) - (placed.x + placed.width), height: free.height });
  }
  if (placed.y > free.y) {
    out.push({ x: free.x, y: free.y, width: free.width, height: placed.y - free.y });
  }
  if (placed.y + placed.height < free.y + free.height) {
    out.push({ x: free.x, y: placed.y + placed.height, width: free.width, height: (free.y + free.height) - (placed.y + placed.height) });
  }
  return out;
}

function isContained(a: Rect, b: Rect): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
}

// Drops free rectangles that are fully inside another free rectangle —
// without this, the free-rect list balloons with redundant candidates as
// more pieces get placed.
function pruneContained(rects: Rect[]): Rect[] {
  return rects.filter((r, i) => !rects.some((other, j) => i !== j && isContained(r, other)));
}

// Maximal Rectangles bin packing (Best Area Fit) — the same family of
// algorithm used for game texture atlas packing. Tracks every leftover
// free rectangle rather than just "shelves", so it can fill pockets left
// beside/below shorter pieces instead of only ever stacking new rows. The
// sheet width is fixed and height grows to fit, so packing starts against
// a generously tall virtual sheet and the real height is measured from
// wherever pieces actually landed.
//
// `gapCm` is the cuttable margin: each piece reserves its own size plus one
// gap, so neighbouring prints never touch, and the same gap is used as the
// sheet's outer margin so nothing sits flush against the film edge.
type RotationMode = 'none' | 'small' | 'envelope';

function packOnce(items: PackItem[], sheetWidthCm: number, gapCm: number, mode: RotationMode): PackResult {
  const allowRotation = mode !== 'none';
  const pad = Math.max(0, gapCm);
  const usableWidth = sheetWidthCm - pad * 2;
  if (usableWidth <= 0) return { placed: [], sheetWidthCm, sheetHeightCm: 0 };

  const sorted = [...items].sort((a, b) => b.heightCm - a.heightCm || b.widthCm - a.widthCm);
  // The virtual sheet must be tall enough for the worst case, which with
  // rotation allowed is every piece turned on its side.
  const tallEnough = sorted.reduce((sum, i) => sum + (allowRotation ? Math.max(i.widthCm, i.heightCm) : i.heightCm) + pad, 0) + pad;

  let freeRects: Rect[] = [{ x: pad, y: pad, width: usableWidth, height: tallEnough }];
  const placed: PlacedItem[] = [];

  for (const item of sorted) {
    // Turning a piece converts its width into sheet *length*, which is what
    // gets bought. Rotating freely makes sheets longer: a 25cm-wide print
    // turned into a side strip consumes 25cm of length, where upright it
    // costs only its 4.2cm height. So a rotated placement is only considered
    // when it lands inside the length the sheet has already committed to —
    // rotation fills space that has effectively been paid for, and can never
    // stretch the sheet. A piece that cannot fit upright anywhere is still
    // turned, since that's the only way to place it at all.
    const envelopeCm = placed.reduce((max, p) => Math.max(max, p.y + footprint(p).heightCm), 0);
    const fitsUprightSomewhere = freeRects.some(r =>
      item.widthCm + pad <= r.width && item.heightCm + pad <= r.height);
    const canTurn = allowRotation && Math.abs(item.widthCm - item.heightCm) > 1e-9;

    let best: { rect: Rect; rotated: boolean; leftover: number } | null = null;
    for (const r of freeRects) {
      for (const rotated of [false, true]) {
        if (rotated && !canTurn) continue;
        const w = rotated ? item.heightCm : item.widthCm;
        const h = rotated ? item.widthCm : item.heightCm;
        const cellWidth = w + pad;
        const cellHeight = h + pad;
        if (cellWidth > r.width || cellHeight > r.height) continue;
        if (rotated) {
          // Two heuristics, each of which wins on different sheets; packShelves
          // runs both and keeps the shorter result.
          if (mode === 'small' && fitsUprightSomewhere) {
            // Only pieces that are small next to the sheet are worth turning.
            if (Math.max(item.widthCm, item.heightCm) > sheetWidthCm * 0.25) continue;
          } else if (mode === 'envelope' && fitsUprightSomewhere) {
            // Only fill length the sheet already needs.
            if (r.y + cellHeight > envelopeCm + 1e-9) continue;
          }
        }
        const leftover = r.width * r.height - cellWidth * cellHeight;
        if (!best
          || leftover < best.leftover - 1e-9
          || (Math.abs(leftover - best.leftover) < 1e-9 && best.rotated && !rotated)) {
          best = { rect: r, rotated, leftover };
        }
      }
    }
    // Shouldn't happen — the sheet-wide starter rect plus the generous
    // height bound guarantee every item fits somewhere — but skip rather
    // than throw if it ever does.
    if (!best) continue;

    // The footprint includes the gap; the artwork is drawn at its top-left,
    // leaving the margin to the right and below.
    const placedWidth = (best.rotated ? item.heightCm : item.widthCm) + pad;
    const placedHeight = (best.rotated ? item.widthCm : item.heightCm) + pad;
    const placedRect: Rect = { x: best.rect.x, y: best.rect.y, width: placedWidth, height: placedHeight };
    placed.push({ ...item, x: placedRect.x, y: placedRect.y, rotated: best.rotated || undefined });

    freeRects = pruneContained(freeRects.flatMap(r => splitFreeRect(r, placedRect)).filter(r => r.width > 1e-6 && r.height > 1e-6));
  }

  const sheetHeightCm = placed.reduce((max, p) => Math.max(max, p.y + footprint(p).heightCm + pad), 0);
  return { placed, sheetWidthCm, sheetHeightCm };
}

/**
 * Packs the sheet, optionally allowing pieces to be turned 90°.
 *
 * Both layouts are computed and the shorter sheet wins: rotating can fill
 * otherwise-wasted gaps, but the greedy fill can also fragment the remaining
 * space and end up taller, and film is bought by length — so rotation is only
 * ever allowed to help.
 */
export function packShelves(items: PackItem[], sheetWidthCm: number, gapCm = 0, allowRotation = false): PackResult {
  const candidates: PackResult[] = [packOnce(items, sheetWidthCm, gapCm, 'none')];
  if (allowRotation) {
    candidates.push(packOnce(items, sheetWidthCm, gapCm, 'small'));
    candidates.push(packOnce(items, sheetWidthCm, gapCm, 'envelope'));
  }

  // Whichever layout places the most pieces wins; ties go to the shortest
  // sheet, since film is bought by length. Rotation can therefore never make
  // a sheet worse than leaving it off.
  return candidates.reduce((best, candidate) => {
    if (candidate.placed.length !== best.placed.length) {
      return candidate.placed.length > best.placed.length ? candidate : best;
    }
    return candidate.sheetHeightCm < best.sheetHeightCm - 1e-9 ? candidate : best;
  });
}
