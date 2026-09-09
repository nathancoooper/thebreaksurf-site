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
const HOUR_PX = 56;
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

function minutesSinceMidnight(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export default function PickupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PickupData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [focusedDay, setFocusedDay] = useState<string | null>(null);
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
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  // Bookable future slots, grouped by day; days with any availability flagged.
  const { slotsByDay, openDays } = useMemo(() => {
    const byDay = new Map<string, SlotOption[]>();
    const open = new Set<string>();
    const t = new Date();
    for (const s of data?.slots ?? []) {
      const start = new Date(s.startsAt);
      if (start < t) continue;
      if (minutesSinceMidnight(s.startsAt) >= GRID_END_MIN || minutesSinceMidnight(s.endsAt) <= GRID_START_MIN) continue;
      const k = dayKey(start);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(s);
      if (s.remaining > 0 || s.mine) open.add(k);
    }
    for (const list of byDay.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return { slotsByDay: byDay, openDays: open };
  }, [data]);

  const todayKey = dayKey(new Date());

  const monthLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' });
    return fmt(week[0]) === fmt(week[6]) ? `${fmt(week[0])} ${week[6].getFullYear()}` : `${fmt(week[0])} – ${fmt(week[6])} ${week[6].getFullYear()}`;
  }, [week]);

  const hours = Array.from({ length: (GRID_END_MIN - GRID_START_MIN) / 60 }, (_, i) => GRID_START_MIN / 60 + i);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row">
        {/* ── Sidebar ─────────────────────────────── */}
        <aside className="w-full shrink-0 rounded-xl bg-white p-5 shadow-sm lg:w-64">
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

          {/* Mini week */}
          <div className="mt-5 border-t border-gray-100 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">This week</p>
              <div className="flex gap-1">
                <button onClick={() => setWeekOffset(o => Math.max(0, o - 1))} disabled={weekOffset === 0}
                  aria-label="Previous week" className="rounded-full px-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30">‹</button>
                <button onClick={() => setWeekOffset(0)}
                  className="rounded-full px-2 text-xs font-medium text-gray-500 hover:bg-gray-100">Today</button>
                <button onClick={() => setWeekOffset(o => Math.min(MAX_WEEK_OFFSET, o + 1))} disabled={weekOffset === MAX_WEEK_OFFSET}
                  aria-label="Next week" className="rounded-full px-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30">›</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {week.map(d => {
                const k = dayKey(d);
                const isToday = k === todayKey;
                const open = openDays.has(k);
                const focused = focusedDay === k;
                return (
                  <button
                    key={k}
                    onClick={() => setFocusedDay(focused ? null : k)}
                    className={`flex flex-col items-center rounded-md py-1.5 ${
                      focused ? 'bg-forest text-cream' : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className={`text-[10px] font-medium ${focused ? 'text-cream/70' : 'text-gray-400'}`}>
                      {d.toLocaleDateString('en-GB', { weekday: 'narrow' })}
                    </span>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday && !focused ? 'bg-[#C4622D] font-semibold text-white' : focused ? 'font-semibold' : open ? 'font-medium text-gray-900' : 'text-gray-300'
                    }`}>
                      {d.getDate()}
                    </span>
                    {open && <span className={`h-1 w-1 rounded-full ${focused ? 'bg-cream' : 'bg-forest'}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-xs text-gray-500">
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-forest/30" /> Available</p>
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#C4622D]/40" /> Your booking</p>
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-gray-200" /> Full</p>
            <p className="pt-1 text-gray-400">🌍 {tz}</p>
          </div>
        </aside>

        {/* ── Week view ───────────────────────────── */}
        <main className="min-w-0 flex-1">
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-3xl font-bold text-forest">{monthLabel}</h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => setWeekOffset(o => Math.max(0, o - 1))} disabled={weekOffset === 0}
                    aria-label="Previous week" className="rounded-full bg-white px-2.5 py-1 text-sm text-forest shadow-sm disabled:opacity-30">‹</button>
                  <button onClick={() => setWeekOffset(0)}
                    className="rounded-full bg-white px-3 py-1 text-sm font-medium text-forest shadow-sm">Today</button>
                  <button onClick={() => setWeekOffset(o => Math.min(MAX_WEEK_OFFSET, o + 1))} disabled={weekOffset === MAX_WEEK_OFFSET}
                    aria-label="Next week" className="rounded-full bg-white px-2.5 py-1 text-sm text-forest shadow-sm disabled:opacity-30">›</button>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm">
                <div className="min-w-[760px]">
                  <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
                    <div />
                    {week.map(d => {
                      const isToday = dayKey(d) === todayKey;
                      return (
                        <div key={d.toISOString()} className="px-2 py-2 text-center text-sm">
                          <span className="text-forest/70">{d.toLocaleDateString('en-GB', { weekday: 'short' })} </span>
                          {isToday ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#C4622D] font-semibold text-white">{d.getDate()}</span>
                          ) : (
                            <span className="text-forest">{d.getDate()}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid border-y border-forest/10" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
                    <div className="px-1 py-1 text-[10px] text-forest/40">all-day</div>
                    {week.map(d => <div key={d.toISOString()} className="border-l border-forest/10" />)}
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
                    <div className="relative" style={{ height: hours.length * HOUR_PX }}>
                      {hours.map(h => (
                        <div key={h} className="absolute right-1 text-[10px] text-forest/40" style={{ top: (h - GRID_START_MIN / 60) * HOUR_PX - 7 }}>
                          {String(h).padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>
                    {week.map(d => {
                      const k = dayKey(d);
                      const isToday = k === todayKey;
                      const focused = focusedDay === k;
                      return (
                        <div key={d.toISOString()} className={`relative border-l border-forest/10 ${isToday ? 'bg-forest/[0.04]' : ''} ${focused ? 'bg-forest/[0.08]' : ''}`}
                          style={{ height: hours.length * HOUR_PX }}>
                          {hours.map(h => (
                            <div key={h} className="absolute left-0 right-0 border-t border-forest/10"
                              style={{ top: (h - GRID_START_MIN / 60) * HOUR_PX }} />
                          ))}
                          {(slotsByDay.get(k) ?? []).map(s => {
                            const top = Math.max(0, (minutesSinceMidnight(s.startsAt) - GRID_START_MIN) / 60 * HOUR_PX);
                            const bottom = Math.min(hours.length * HOUR_PX, (minutesSinceMidnight(s.endsAt) - GRID_START_MIN) / 60 * HOUR_PX);
                            const full = s.remaining <= 0 && !s.mine;
                            const active = selected === s.id;
                            return (
                              <button
                                key={s.id}
                                disabled={full}
                                onClick={() => setSelected(s.id)}
                                className={`absolute left-1 right-1 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight ${
                                  active
                                    ? 'bg-forest text-cream shadow'
                                    : full
                                      ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                                      : s.mine
                                        ? 'bg-[#C4622D]/25 text-forest ring-1 ring-[#C4622D]'
                                        : 'bg-forest/15 text-forest hover:bg-forest/25'
                                }`}
                                style={{ top, height: Math.max(30, bottom - top) }}
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

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-xl bg-forest px-5 py-3 text-cream shadow-lg">
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
