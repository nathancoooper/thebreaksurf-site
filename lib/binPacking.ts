export interface PackItem {
  id: string;
  widthCm: number;
  heightCm: number;
}

export interface PlacedItem extends PackItem {
  x: number;
  y: number;
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
export function packShelves(items: PackItem[], sheetWidthCm: number): PackResult {
  const sorted = [...items].sort((a, b) => b.heightCm - a.heightCm || b.widthCm - a.widthCm);
  const tallEnough = sorted.reduce((sum, i) => sum + i.heightCm, 0) + 1;

  let freeRects: Rect[] = [{ x: 0, y: 0, width: sheetWidthCm, height: tallEnough }];
  const placed: PlacedItem[] = [];

  for (const item of sorted) {
    let best: Rect | null = null;
    let bestLeftoverArea = Infinity;
    for (const r of freeRects) {
      if (item.widthCm <= r.width && item.heightCm <= r.height) {
        const leftover = r.width * r.height - item.widthCm * item.heightCm;
        if (leftover < bestLeftoverArea) { bestLeftoverArea = leftover; best = r; }
      }
    }
    // Shouldn't happen — the sheet-wide starter rect plus the generous
    // height bound guarantee every item fits somewhere — but skip rather
    // than throw if it ever does.
    if (!best) continue;

    const placedRect: Rect = { x: best.x, y: best.y, width: item.widthCm, height: item.heightCm };
    placed.push({ ...item, x: placedRect.x, y: placedRect.y });

    freeRects = pruneContained(freeRects.flatMap(r => splitFreeRect(r, placedRect)).filter(r => r.width > 1e-6 && r.height > 1e-6));
  }

  const sheetHeightCm = placed.reduce((max, p) => Math.max(max, p.y + p.heightCm), 0);
  return { placed, sheetWidthCm, sheetHeightCm };
}
