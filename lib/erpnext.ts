const BASE = process.env.ERPNEXT_URL!;
const TOKEN = `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`;

const HEADERS = {
  'Authorization': TOKEN,
  'Content-Type': 'application/json',
};

export async function erpFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...HEADERS, ...opts?.headers } });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`ERPNext ${res.status}: ${text}`);
  }
  return res.json();
}

export async function erpList<T>(
  doctype: string,
  opts: { fields: string[]; filters?: unknown[][]; orderBy?: string; limit?: number; start?: number } = { fields: ['name'] },
): Promise<T[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(opts.fields),
    limit: String(opts.limit ?? 50),
    // Frappe's REST list endpoint doesn't recognise a bare "start" param —
    // it silently ignores it and always returns page one, which is exactly
    // why every "Load more" button was re-fetching the same first page.
    limit_start: String(opts.start ?? 0),
    order_by: opts.orderBy ?? 'modified desc',
  });
  if (opts.filters) params.set('filters', JSON.stringify(opts.filters));
  const data = await erpFetch(`/api/resource/${encodeURIComponent(doctype)}?${params}`);
  return data.data as T[];
}

export async function erpGet<T>(doctype: string, name: string): Promise<T> {
  const data = await erpFetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  return data.data as T;
}

// Use frappe.client.set_value to patch individual fields on submitted docs
export async function erpSetValue(doctype: string, name: string, fieldname: string, value: unknown) {
  const result = await erpFetch('/api/method/frappe.client.set_value', {
    method: 'POST',
    body: JSON.stringify({ doctype, name, fieldname, value }),
  });
  clearErpCache();
  return result;
}

export async function erpCreate<T>(doctype: string, doc: object): Promise<T> {
  const data = await erpFetch(`/api/resource/${encodeURIComponent(doctype)}`, {
    method: 'POST',
    body: JSON.stringify({ ...doc, doctype }),
  });
  clearErpCache();
  return data.data as T;
}

export async function erpUpdate<T>(doctype: string, name: string, doc: object): Promise<T> {
  const data = await erpFetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(doc),
  });
  clearErpCache();
  return data.data as T;
}

// frappe.client.submit needs the full doc (not just doctype+name) to validate against
export async function erpSubmit(doctype: string, name: string) {
  const doc = await erpGet<Record<string, unknown>>(doctype, name);
  const result = await erpFetch('/api/method/frappe.client.submit', {
    method: 'POST',
    body: JSON.stringify({ doc: JSON.stringify(doc) }),
  });
  clearErpCache();
  return result;
}

export async function erpCancel(doctype: string, name: string) {
  const result = await erpFetch('/api/method/frappe.client.cancel', {
    method: 'POST',
    body: JSON.stringify({ doctype, name }),
  });
  clearErpCache();
  return result;
}

// ─── Route-level read cache ─────────────────────────────────────────────────
//
// Individual erpList/erpGet calls above are always live. Read-only admin
// pages (stock, finance report, directors loans) instead wrap their *whole*
// set of ERPNext reads in erpCached() below, keyed per page (plus any query
// params), so the page can report back when its data actually came from
// ERPNext — "just now" on a cache miss, or the original fetch time if served
// from cache. The journal-entries page (read-write) never uses this, so it
// stays genuinely live; any write above clears this cache so a save is
// reflected immediately elsewhere (e.g. the finance report).

export const ERP_CACHE_HOUR = 60 * 60 * 1000;

interface CacheEntry<T> { data: T; fetchedAt: number; expiresAt: number }
const routeCache = new Map<string, CacheEntry<unknown>>();

export async function erpCached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<{ data: T; fetchedAt: number }> {
  const cached = routeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data as T, fetchedAt: cached.fetchedAt };
  }
  const data = await fn();
  const fetchedAt = Date.now();
  routeCache.set(key, { data, fetchedAt, expiresAt: fetchedAt + ttlMs });
  return { data, fetchedAt };
}

function clearErpCache() {
  routeCache.clear();
}
