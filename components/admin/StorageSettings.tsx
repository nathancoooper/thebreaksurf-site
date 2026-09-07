'use client';

import { useEffect, useState } from 'react';

interface Category { name: string; bytes: number }

const COLORS: Record<string, string> = {
  'Products': '#3b82f6',
  'Events': '#22c55e',
  'Heroes': '#a855f7',
  'Posts / Writing': '#f59e0b',
  'Meetings': '#6366f1',
  'Social posts': '#14b8a6',
  'University': '#f97316',
  'Receipts': '#ec4899',
  'Email attachments': '#8b5cf6',
  'Other uploads': '#9ca3af',
};

function fmtBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function StorageSettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  function load() {
    setLoading(true);
    setError(false);
    fetch('/api/admin/storage', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setCategories(d.categories ?? []); setTotalBytes(d.totalBytes ?? 0); setLoadedAt(Date.now()); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const sorted = [...categories].sort((a, b) => b.bytes - a.bytes);

  return (
    <div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading R2 usage…</p>
      ) : error ? (
        <div>
          <p className="text-sm text-gray-400">Couldn&rsquo;t load storage usage.</p>
          <button onClick={load} className="mt-2 text-sm text-gray-600 underline">Retry</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-gray-500">
              R2 bucket usage. Total: <span className="font-semibold text-gray-900">{fmtBytes(totalBytes)}</span>
            </p>
            {loadedAt && (
              <p className="text-[11px] text-gray-300">
                Last updated {new Date(loadedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="space-y-2">
            {sorted.map(c => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[c.name] ?? '#d1d5db' }} />
                <span className="w-40 text-sm text-gray-900">{c.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${totalBytes > 0 ? (c.bytes / totalBytes) * 100 : 0}%`, backgroundColor: COLORS[c.name] ?? '#d1d5db' }}
                  />
                </div>
                <span className="w-20 text-right text-sm text-gray-500">{fmtBytes(c.bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}