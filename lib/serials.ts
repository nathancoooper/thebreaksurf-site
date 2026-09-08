import { getDb } from './db';
import { erpList } from './erpnext';
import { readData } from './dataCache';
import type { Product } from '@/types';

const APP_URL = process.env.APP_URL || 'https://thebreaksurf.co.uk';

export interface ErpSerial {
  name: string;
  item_code: string;
  warehouse: string | null;
  status: string;
}

export interface TagData {
  serial: string;
  itemCode: string;
  productName: string | null;
  colour: string | null;
  size: string | null;
  colorHex: string | null;
  price: number | null;
  qrUrl: string;
}

async function readPrints(): Promise<Record<string, string>> {
  const db = getDb();
  const rows = await db.prepare('SELECT serial, printed_at FROM tag_prints').all<{ serial: string; printed_at: string }>();
  const registry: Record<string, string> = {};
  for (const row of rows.results) {
    registry[row.serial] = row.printed_at;
  }
  return registry;
}

export async function listActiveSerials(hardCap = 5000): Promise<ErpSerial[]> {
  const all: ErpSerial[] = [];
  const pageSize = 200;
  for (let start = 0; start < hardCap; start += pageSize) {
    const batch = await erpList<ErpSerial>('Serial No', {
      fields: ['name', 'item_code', 'warehouse', 'status'],
      filters: [['status', '=', 'Active']],
      orderBy: 'creation asc',
      limit: pageSize,
      start,
    });
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

export async function matchProduct(itemCode: string): Promise<Product | null> {
  const products = await readData<Product>('products');
  const filtered = products.filter(p => p.erpItemPrefix);
  let best: Product | null = null;
  for (const p of filtered) {
    const prefix = p.erpItemPrefix!;
    if ((itemCode === prefix || itemCode.startsWith(`${prefix}-`)) && (!best || prefix.length > best.erpItemPrefix!.length)) {
      best = p;
    }
  }
  return best;
}

export function parseItemCode(itemCode: string, prefix?: string): { colour: string | null; size: string | null } {
  const rest = prefix && (itemCode === prefix || itemCode.startsWith(`${prefix}-`))
    ? itemCode.slice(prefix.length + 1)
    : itemCode;
  const parts = rest.split('-').filter(Boolean);
  if (parts.length < 2) return { colour: parts[0] ?? null, size: null };
  return { colour: parts.slice(0, -1).join('-'), size: parts[parts.length - 1] };
}

export async function buildTagData(serial: ErpSerial): Promise<TagData> {
  const product = await matchProduct(serial.item_code);
  const { colour, size } = parseItemCode(serial.item_code, product?.erpItemPrefix);
  return {
    serial: serial.name,
    itemCode: serial.item_code,
    productName: product?.name ?? null,
    colour,
    size,
    colorHex: (colour && product?.colorHex?.[colour]) || null,
    price: product?.price ?? null,
    qrUrl: `${APP_URL}/t/${encodeURIComponent(serial.name)}`,
  };
}

export async function getUnprintedSerials(itemCode?: string): Promise<ErpSerial[]> {
  const [all, prints] = await Promise.all([listActiveSerials(), readPrints()]);
  return all.filter(s => !prints[s.name] && (!itemCode || s.item_code === itemCode));
}

export async function getUnprintedSummary(): Promise<{ itemCode: string; active: number; unprinted: number }[]> {
  const [all, prints] = await Promise.all([listActiveSerials(), readPrints()]);
  const byItem = new Map<string, { active: number; unprinted: number }>();
  for (const s of all) {
    const entry = byItem.get(s.item_code) ?? { active: 0, unprinted: 0 };
    entry.active += 1;
    if (!prints[s.name]) entry.unprinted += 1;
    byItem.set(s.item_code, entry);
  }
  return [...byItem.entries()]
    .map(([itemCode, counts]) => ({ itemCode, ...counts }))
    .sort((a, b) => b.unprinted - a.unprinted || a.itemCode.localeCompare(b.itemCode));
}

export async function markPrinted(serialNames: string[]): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();
  let added = 0;
  for (const name of serialNames) {
    const existing = await db.prepare('SELECT serial FROM tag_prints WHERE serial = ?')
      .bind(name)
      .first();
    if (!existing) added += 1;
    await db.prepare(
      'INSERT INTO tag_prints (serial, printed_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE printed_at = ?'
    )
      .bind(name, now, now)
      .run();
  }
  return added;
}
