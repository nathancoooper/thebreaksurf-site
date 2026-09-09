'use client';

import { use, useEffect, useMemo, useState } from 'react';

interface SlotOption {
  id: string;
  startsAt: string;
  endsAt: string;
  note?: string;
  capacity: number;
  booked: number;
  mine: boolean;
  remaining: number;
}

interface PickupData {
  studentName: string;
  garment: string;
  ready: boolean;
  currentSlotId: string | null;
  pickupBookedAt: string | null;
  slots: SlotOption[];
}

const GRID_START_MIN = 8 * 60;
const GRID_END_MIN = 20 * 60;
const GRID_TOTAL_MIN = GRID_END_MIN - GRID_START_MIN;
const GRID_HOURS = GRID_TOTAL_MIN / 60;
const GUTTER_PX = 48;
const COL_MIN_PX = 96;
const MAX_WEEK_OFFSET = 3;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOfWeek(offset: number) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
  return monday;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function mins(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export default function PickupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PickupData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<SlotOption | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/pickup/${token}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) { setInvalid(true); return; }
        setData(d);
        if (d.currentSlotId) setSelected(d.currentSlotId);
      })
      .catch(() => setInvalid(true));
  }, [token]);

  const week = useMemo(() => {
    const monday = mondayOfWeek(weekOffset);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; });
  }, [weekOffset]);

  const slotsByDay = useMemo(() => {
    const byDay = new Map<string, SlotOption[]>();
    const t = new Date();
    for (const s of data?.slots ?? []) {
      if (new Date(s.startsAt) < t) continue;
      if (mins(s.startsAt) >= GRID_END_MIN || mins(s.endsAt) <= GRID_START_MIN) continue;
      const k = dayKey(new Date(s.startsAt));
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(s);
    }
    for (const list of byDay.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return byDay;
  }, [data]);

  const todayKey = dayKey(new Date());
  const hourRows = Array.from({ length: GRID_HOURS }, (_, i) => GRID_START_MIN / 60 + i);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const monthLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' });
    return fmt(week[0]) === fmt(week[6]) ? `${fmt(week[0])} ${week[6].getFullYear()}` : `${fmt(week[0])} – ${fmt(week[6])} ${week[6].getFullYear()}`;
  }, [week]);

  async function confirm() {
    if (!selected || !data) return;
    setSaving(true); setError('');
    const res = await fetch(`/api/pickup/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: selected }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) { setError(body?.error ?? 'Could not book that slot'); return; }
    setDone(data.slots.find(s => s.id === selected) ?? null);
  }

  const selectedSlot = data?.slots.find(s => s.id === selected) ?? null;
  const currentSlot = data?.slots.find(s => s.id === data.currentSlotId) ?? null;
  const gridCols = `${GUTTER_PX}px repeat(7, minmax(${COL_MIN_PX}px, 1fr))`;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-72px-3rem)] lg:flex-row lg:overflow-hidden">

        {/* ── Sidebar ─────────────────────────────── */}
        <aside className="w-full shrink-0 rounded-xl bg-white p-5 shadow-sm lg:w-64 lg:overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest/50">The Break × AUB</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">Pick up your garment</h1>
          {data && !done && (
            <p className="mt-2 text-sm text-gray-500">
              Hi {data.studentName} — your <strong className="text-gray-700">{data.garment}</strong> is ready. Tap a green window.
            </p>
          )}
          {currentSlot && !done && (
            <p className="mt-3 rounded-md bg-forest/10 px-3 py-2 text-xs text-forest">
              Booked: {new Date(currentSlot.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' '}{fmtTime(currentSlot.startsAt)} — picking a new time moves it.
            </p>
          )}
          <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-xs text-gray-500">
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-forest/30" /> Available</p>
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#C4622D]/40" /> Your booking</p>
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-gray-200" /> Full</p>
            <p className="pt-1 text-gray-400">🌍 {tz}</p>
          </div>
        </aside>

        {/* ── Week view ───────────────────────────── */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {invalid ? (
            <p className="rounded-xl bg-white p-8 text-sm text-gray-600 shadow-sm">
              This pick-up link isn&apos;t recognised. Ask us for a fresh one.
            </p>
          ) : !data ? (
            <p className="text-sm text-forest/60">Loading your calendar…</p>
          ) : done ? (
            <div className="mx-auto max-w-lg rounded-xl bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-forest text-xl text-cream">✓</div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">You&apos;re booked in</h2>
              <p className="mt-2 text-sm text-gray-600">
                {new Date(done.startsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' '}· {fmtTime(done.startsAt)} – {fmtTime(done.endsAt)}
                {done.note ? ` · ${done.note}` : ''}
              </p>
              <p className="mt-1 text-xs text-gray-400">Bring your name — we&apos;ll have your {data.garment} ready.</p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                <h2 className="text-3xl font-bold text-forest">{monthLabel}</h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => setWeekOffset(o => Math.max(0, o - 1))} disabled={weekOffset === 0}
                    aria-label="Previous week" className="rounded-full bg-white px-2.5 py-1 text-sm text-forest shadow-sm disabled:opacity-30">‹</button>
                  <button onClick={() => setWeekOffset(0)}
                    className="rounded-full bg-white px-3 py-1 text-sm font-medium text-forest shadow-sm">This week</button>
                  <button onClick={() => setWeekOffset(o => Math.min(MAX_WEEK_OFFSET, o + 1))} disabled={weekOffset === MAX_WEEK_OFFSET}
                    aria-label="Next week" className="rounded-full bg-white px-2.5 py-1 text-sm text-forest shadow-sm disabled:opacity-30">›</button>
                </div>
              </div>

              {error && <p className="mt-2 shrink-0 text-sm text-red-600">{error}</p>}

              {/* Calendar grid — fills available height on desktop, scrolls on small screens */}
              <div className="mt-3 min-h-0 flex-1 overflow-x-auto rounded-xl bg-white shadow-sm lg:overflow-hidden">
                <div className="flex h-full min-h-[480px] min-w-[760px] flex-col">
                  {/* Day headers */}
                  <div className="grid shrink-0" style={{ gridTemplateColumns: gridCols }}>
                    <div />
                    {week.map(d => {
                      const isToday = dayKey(d) === todayKey;
                      return (
                        <div key={d.toISOString()} className="px-1 py-2 text-center text-sm">
                          <span className="text-forest/70">{d.toLocaleDateString('en-GB', { weekday: 'short' })} </span>
                          {isToday
                            ? <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#C4622D] font-semibold text-white">{d.getDate()}</span>
                            : <span className="text-forest">{d.getDate()}</span>}
                        </div>
                      );
                    })}
                  </div>
                  {/* All-day row */}
                  <div className="grid shrink-0 border-y border-forest/10" style={{ gridTemplateColumns: gridCols }}>
                    <div className="px-1 py-1 text-[10px] text-forest/40">all-day</div>
                    {week.map(d => <div key={d.toISOString()} className="border-l border-forest/10" />)}
                  </div>
                  {/* Time body — hour rows share height equally, slots positioned by % */}
                  <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: gridCols }}>
                    {/* Gutter */}
                    <div className="flex flex-col">
                      {hourRows.map(h => (
                        <div key={h} className="relative flex-1 border-t border-forest/10 first:border-t-0">
                          <span className="absolute -top-2 right-1 bg-white pr-0.5 text-[10px] text-forest/40">
                            {String(h).padStart(2, '0')}:00
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Day columns */}
                    {week.map(d => {
                      const k = dayKey(d);
                      const isToday = k === todayKey;
                      return (
                        <div key={d.toISOString()} className={`relative border-l border-forest/10 ${isToday ? 'bg-forest/[0.04]' : ''}`}>
                          <div className="absolute inset-0 flex flex-col">
                            {hourRows.map(h => (
                              <div key={h} className="flex-1 border-t border-forest/10 first:border-t-0" />
                            ))}
                          </div>
                          {(slotsByDay.get(k) ?? []).map(s => {
                            const topPct = Math.max(0, (mins(s.startsAt) - GRID_START_MIN) / GRID_TOTAL_MIN * 100);
                            const heightPct = Math.max(4, (mins(s.endsAt) - mins(s.startsAt)) / GRID_TOTAL_MIN * 100);
                            const full = s.remaining <= 0 && !s.mine;
                            const active = selected === s.id;
                            return (
                              <button
                                key={s.id}
                                disabled={full}
                                onClick={() => setSelected(s.id)}
                                className={`absolute left-1 right-1 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight ${
                                  active ? 'bg-forest text-cream shadow'
                                    : full ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                                    : s.mine ? 'bg-[#C4622D]/25 text-forest ring-1 ring-[#C4622D]'
                                    : 'bg-forest/15 text-forest hover:bg-forest/25'
                                }`}
                                style={{ top: `${topPct}%`, height: `calc(${heightPct}% - 2px)` }}
                                title={s.note ?? ''}
                              >
                                <span className="font-semibold">{fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}</span>
                                <span className="block opacity-75">
                                  {s.mine ? 'yours ✓' : full ? 'full' : `${s.remaining} left`}{s.note ? ` · ${s.note}` : ''}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Confirm bar */}
              <div className="mt-3 flex shrink-0 items-center justify-between gap-3 rounded-xl bg-forest px-5 py-3 text-cream shadow-lg">
                <p className="text-sm">
                  {selectedSlot ? (
                    <>
                      <strong>
                        {new Date(selectedSlot.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' '}{fmtTime(selectedSlot.startsAt)}–{fmtTime(selectedSlot.endsAt)}
                      </strong>
                      {selectedSlot.note ? <span className="opacity-70"> · {selectedSlot.note}</span> : null}
                    </>
                  ) : (
                    <span className="opacity-70">Tap a green window above</span>
                  )}
                </p>
                <button onClick={confirm} disabled={!selected || saving}
                  className="shrink-0 rounded-md bg-cream px-5 py-2 text-sm font-semibold text-forest disabled:opacity-50">
                  {saving ? 'Booking…' : data.currentSlotId ? 'Change my slot' : 'Confirm slot'}
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
