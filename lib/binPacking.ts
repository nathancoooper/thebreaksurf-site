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
function packOnce(items: PackItem[], sheetWidthCm: number, gapCm: number, allowRotation: boolean): PackResult {
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
    // Try both orientations when allowed: a wide piece can slot into a tall
    // gap that would otherwise be wasted. Ties go to the unrotated layout, so
    // a design is only turned when it genuinely packs tighter.
    //
    // Turning a piece converts its width into sheet height, so a large design
    // rotated into a narrow gap would consume far more length than it saves.
    // Rotation is therefore limited to pieces that are small next to the sheet
    // (which is what fills leftover strips) and to any piece that cannot fit
    // the sheet upright at all (where rotating is the only option).
    const orientations = [{ w: item.widthCm, h: item.heightCm, rotated: false }];
    const fitsUpright = item.widthCm + pad <= usableWidth;
    const smallNextToSheet = Math.max(item.widthCm, item.heightCm) <= sheetWidthCm * 0.25;
    if (allowRotation && (!fitsUpright || smallNextToSheet) && Math.abs(item.widthCm - item.heightCm) > 1e-9) {
      orientations.push({ w: item.heightCm, h: item.widthCm, rotated: true });
    }

    let best: { rect: Rect; rotated: boolean; leftover: number } | null = null;
    for (const r of freeRects) {
      for (const o of orientations) {
        const cellWidth = o.w + pad;
        const cellHeight = o.h + pad;
        if (cellWidth > r.width || cellHeight > r.height) continue;
        const leftover = r.width * r.height - cellWidth * cellHeight;
        if (!best
          || leftover < best.leftover - 1e-9
          || (Math.abs(leftover - best.leftover) < 1e-9 && best.rotated && !o.rotated)) {
          best = { rect: r, rotated: o.rotated, leftover };
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
  const plain = packOnce(items, sheetWidthCm, gapCm, false);
  if (!allowRotation) return plain;

  const rotated = packOnce(items, sheetWidthCm, gapCm, true);
  if (rotated.placed.length !== plain.placed.length) {
    // Prefer the layout that placed more pieces.
    return rotated.placed.length > plain.placed.length ? rotated : plain;
  }
  return rotated.sheetHeightCm < plain.sheetHeightCm - 1e-9 ? rotated : plain;
}
