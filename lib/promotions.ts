import { getDb } from './db';
import type { Promotion } from '@/types';

export async function getPromotions(): Promise<Promotion[]> {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM promotions').all<{ data: string }>();
  return rows.results.map((r: { data: string }) => JSON.parse(r.data) as Promotion);
}

function isActive(promo: Promotion, now: Date): boolean {
  const start = new Date(`${promo.startDate}T00:00:00`);
  const end = new Date(`${promo.endDate}T23:59:59`);
  return now >= start && now <= end;
}

export async function getActivePromotions(): Promise<Promotion[]> {
  const now = new Date();
  const promotions = await getPromotions();
  return promotions.filter(p => isActive(p, now));
}

function appliesTo(promo: Promotion, productId: string): boolean {
  return promo.scope === 'all' || (promo.scope === 'products' && !!promo.productIds?.includes(productId));
}

export async function getDiscountPercent(productId: string): Promise<number> {
  const active = await getActivePromotions();
  return active.reduce((max, p) => (appliesTo(p, productId) && p.discountPercent > max ? p.discountPercent : max), 0);
}

export async function getDiscountMap(productIds: string[]): Promise<Record<string, number>> {
  const active = await getActivePromotions();
  const map: Record<string, number> = {};
  for (const id of productIds) {
    const pct = active.reduce((max, p) => (appliesTo(p, id) && p.discountPercent > max ? p.discountPercent : max), 0);
    if (pct > 0) map[id] = pct;
  }
  return map;
}

export function applyDiscount(priceInPence: number, discountPercent: number): number {
  return Math.round(priceInPence * (1 - discountPercent / 100));
}
