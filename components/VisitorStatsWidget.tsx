'use client';

import { useEffect, useState } from 'react';

const BAR_HIGH = 'rgba(28,28,28,0.7)';
const BAR_LOW  = 'rgba(28,28,28,0.2)';
const BAR_ZERO = 'rgba(28,28,28,0.08)';
const ICON_BG   = 'rgba(28,28,28,0.06)';
const ICON_COLOR = 'rgba(28,28,28,0.5)';

const DAYS = 12;

function formatHits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default function VisitorStatsWidget() {
  const [stats, setStats] = useState<{ hits: number; daily: Record<string, number> }>({ hits: 0, daily: {} });

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => setStats({ hits: data.hits ?? 0, daily: data.daily ?? {} }))
      .catch(() => {});
  }, []);

  const days = lastNDays(DAYS);
  const counts = days.map(d => stats.daily[d] ?? 0);
  const max = Math.max(...counts, 1);
  const visitorBars = counts.map(c => Math.round((c / max) * 100));

  return (
    <div className="stat-widget flex items-center gap-3 rounded-xl bg-transparent px-3 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: ICON_BG }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: ICON_COLOR }} aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div className="text-left">
        <p className="text-xs font-medium text-charcoal">Visitors</p>
        <p className="text-[10px] text-charcoal/40">all time</p>
      </div>
      <div className="flex h-6 items-end gap-0.5">
        {visitorBars.map((h, i) => (
          <div
            key={i}
            className="w-[3px] rounded-sm"
            style={{
              height: h > 0 ? `${Math.max(h, 15)}%` : '15%',
              backgroundColor: h === 100 ? BAR_HIGH : h > 0 ? BAR_LOW : BAR_ZERO,
            }}
          />
        ))}
      </div>
      <p className="min-w-[32px] text-right text-sm font-medium text-charcoal">{formatHits(stats.hits)}</p>
    </div>
  );
}
