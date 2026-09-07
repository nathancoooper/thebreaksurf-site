import { getDb } from './db';
import { erpList } from './erpnext';

interface Bin {
  item_code: string;
  actual_qty: number;
  reserved_qty: number;
}

interface StockSnapshot {
  pulledAt: string | null;
  available: Record<string, number>;
  sold: Record<string, number>;
}

async function readSnapshot(): Promise<StockSnapshot> {
  const db = getDb();
  const row = await db.prepare("SELECT value FROM stock_snapshot WHERE key = 'snapshot'")
    .first<{ value: string }>();
  if (!row) return { pulledAt: null, available: {}, sold: {} };
  return JSON.parse(row.value) as StockSnapshot;
}

async function writeSnapshot(snapshot: StockSnapshot): Promise<void> {
  const db = getDb();
  await db.prepare(
    "INSERT INTO stock_snapshot (key, value) VALUES ('snapshot', ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()"
  )
    .bind(JSON.stringify(snapshot), JSON.stringify(snapshot))
    .run();
}

async function stockCheckEnabled(): Promise<boolean> {
  const db = getDb();
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'stockCheckEnabled'")
    .first<{ value: string }>();
  return row ? JSON.parse(row.value) === true : false;
}

export function variantItemCode(
  product: { erpItemPrefix?: string },
  color?: string,
  size?: string
): string | null {
  if (!product.erpItemPrefix) return null;
  return [product.erpItemPrefix, color, size].filter(Boolean).join('-');
}

export async function refreshStockSnapshot(): Promise<{ itemCount: number; pulledAt: string }> {
  const bins = await erpList<Bin>('Bin', {
    fields: ['item_code', 'actual_qty', 'reserved_qty'],
    limit: 1000,
  });
  const available: Record<string, number> = {};
  for (const b of bins) {
    available[b.item_code] = (available[b.item_code] ?? 0) + (b.actual_qty - b.reserved_qty);
  }
  const pulledAt = new Date().toISOString();
  await writeSnapshot({ pulledAt, available, sold: {} });
  return { itemCount: Object.keys(available).length, pulledAt };
}

export async function recordSale(itemCode: string, quantity: number) {
  const snapshot = await readSnapshot();
  snapshot.sold[itemCode] = (snapshot.sold[itemCode] ?? 0) + quantity;
  await writeSnapshot(snapshot);
}

function effectiveAvailability(snapshot: StockSnapshot, itemCode: string): number {
  const raw = (snapshot.available[itemCode] ?? 0) - (snapshot.sold[itemCode] ?? 0);
  return Math.max(0, raw);
}

export async function getAvailability(
  product: { erpItemPrefix?: string },
  color?: string,
  size?: string
): Promise<number | null> {
  if (!(await stockCheckEnabled())) return null;
  const code = variantItemCode(product, color, size);
  if (!code) return null;
  const snapshot = await readSnapshot();
  return effectiveAvailability(snapshot, code);
}

export async function getAvailabilityForProducts(
  products: { id: string; erpItemPrefix?: string; colors: string[]; sizes: string[] }[]
): Promise<Record<string, Record<string, number>>> {
  if (!(await stockCheckEnabled())) return {};
  const linked = products.filter(p => p.erpItemPrefix);
  if (linked.length === 0) return {};

  const snapshot = await readSnapshot();
  const result: Record<string, Record<string, number>> = {};

  for (const p of linked) {
    const colors = p.colors.length ? p.colors : [undefined];
    const sizes = p.sizes.length ? p.sizes : [undefined];
    const variants: Record<string, number> = {};
    for (const color of colors) {
      for (const size of sizes) {
        const code = variantItemCode(p, color, size)!;
        variants[`${color ?? ''}|${size ?? ''}`] = effectiveAvailability(snapshot, code);
      }
    }
    result[p.id] = variants;
  }

  return result;
}
