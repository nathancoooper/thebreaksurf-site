import { getDb } from './db';

export interface SupplierItem {
  item_code: string;
  item_name: string;
  aliases: string[];
}

export interface Supplier {
  name: string;
  vat_inclusive?: boolean;
  items: SupplierItem[];
}

export interface SupplierAliasesData {
  suppliers: Supplier[];
}

let cached: SupplierAliasesData | null = null;

export async function readSupplierAliases(): Promise<SupplierAliasesData> {
  if (cached) return cached;
  const db = getDb();
  const row = await db.prepare("SELECT value FROM supplier_aliases WHERE key = 'data'")
    .first<{ value: string }>();
  if (row) {
    cached = JSON.parse(row.value) as SupplierAliasesData;
  } else {
    cached = { suppliers: [] };
  }
  return cached;
}

export async function writeSupplierAliases(data: SupplierAliasesData): Promise<void> {
  const db = getDb();
  await db.prepare(
    "INSERT INTO supplier_aliases (key, value) VALUES ('data', ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')"
  )
    .bind(JSON.stringify(data), JSON.stringify(data))
    .run();
  cached = data;
}

export function clearCache(): void {
  cached = null;
}
