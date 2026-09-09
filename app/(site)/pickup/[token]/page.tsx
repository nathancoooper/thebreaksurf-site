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

const GRID_START_MIN = 8 * 60;   // 08:00
const GRID_END_MIN = 20 * 60;    // 20:00
const HOUR_PX = 56;
const MAX_WEEK_OFFSET = 3;       // today’s week + 3 (covers the 28-day API horizon)

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOfWeek(offset: number) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (monday.getDay() + 6) % 7; // Mon=0 … Sun=6
  monday.setDate(monday.getDate() - dow + offset * 7);
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

  const slotsByDay = useMemo(() => {
    const map = new Map<string, SlotOption[]>();
    for (const s of data?.slots ?? []) {
      // Clamp to the visible grid; skip anything outside 08:00–20:00.
      if (minutesSinceMidnight(s.startsAt) >= GRID_END_MIN || minutesSinceMidnight(s.endsAt) <= GRID_START_MIN) continue;
      const k = dayKey(new Date(s.startsAt));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [data]);

  const monthLabel = useMemo(() => {
    const first = week[0];
    const last = week[6];
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' });
    const year = last.getFullYear();
    return fmt(first) === fmt(last) ? `${fmt(first)} ${year}` : `${fmt(first)} – ${fmt(last)} ${year}`;
  }, [week]);

  const todayKey = dayKey(new Date());
  const hours = Array.from({ length: (GRID_END_MIN - GRID_START_MIN) / 60 }, (_, i) => GRID_START_MIN / 60 + i);

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

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-forest/60">The Break × AUB · pick-up</p>

        {invalid ? (
          <p className="mt-6 max-w-xl rounded-lg bg-white p-6 text-sm text-gray-600 shadow-sm">
            This pick-up link isn&apos;t recognised. Ask us for a fresh one.
          </p>
        ) : !data ? (
          <p className="mt-6 text-sm text-forest/60">Loading your calendar…</p>
        ) : done ? (
          <div className="mt-6 max-w-xl rounded-lg bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-forest">You&apos;re booked in ✓</p>
            <p className="mt-2 text-sm text-gray-600">
              {new Date(done.startsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' '}· {fmtTime(done.startsAt)} – {fmtTime(done.endsAt)}
              {done.note ? ` · ${done.note}` : ''}
            </p>
            <p className="mt-1 text-xs text-gray-400">Bring your name — we&apos;ll have your {data.garment} ready.</p>
          </div>
        ) : (
          <>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-forest">{monthLabel}</h1>
                <p className="mt-1 text-sm text-forest/70">
                  Hi {data.studentName} — your <strong>{data.garment}</strong> is ready. Tap a green window to book it.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
                  disabled={weekOffset === 0}
                  aria-label="Previous week"
                  className="rounded-full bg-forest/10 px-2.5 py-1 text-sm text-forest disabled:opacity-30"
                >‹</button>
                <button
                  onClick={() => setWeekOffset(0)}
                  className="rounded-full bg-forest/10 px-3 py-1 text-sm font-medium text-forest"
                >Today</button>
                <button
                  onClick={() => setWeekOffset(o => Math.min(MAX_WEEK_OFFSET, o + 1))}
                  disabled={weekOffset === MAX_WEEK_OFFSET}
                  aria-label="Next week"
                  className="rounded-full bg-forest/10 px-2.5 py-1 text-sm text-forest disabled:opacity-30"
                >›</button>
              </div>
            </div>

            {/* ── Week grid ─────────────────────────────────── */}
            <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
              <div className="min-w-[840px]">
                {/* Day headers */}
                <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                  <div />
                  {week.map(d => {
                    const isToday = dayKey(d) === todayKey;
                    return (
                      <div key={d.toISOString()} className="px-2 py-2 text-center text-sm">
                        <span className="text-forest/70">
                          {d.toLocaleDateString('en-GB', { weekday: 'short' })}{' '}
                        </span>
                        {isToday ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#C4622D] font-semibold text-white">
                            {d.getDate()}
                          </span>
                        ) : (
                          <span className="text-forest">{d.getDate()}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* All-day strip */}
                <div className="grid border-y border-forest/10" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                  <div className="px-1 py-1 text-[10px] text-forest/40">all-day</div>
                  {week.map(d => <div key={d.toISOString()} className="border-l border-forest/10" />)}
                </div>

                {/* Timed grid */}
                <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                  {/* Gutter */}
                  <div className="relative" style={{ height: hours.length * HOUR_PX }}>
                    {hours.map(h => (
                      <div key={h} className="absolute right-1 text-[10px] text-forest/40" style={{ top: (h - GRID_START_MIN / 60) * HOUR_PX - 7 }}>
                        {String(h).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                  {/* Day columns */}
                  {week.map(d => {
                    const k = dayKey(d);
                    const isToday = k === todayKey;
                    const list = slotsByDay.get(k) ?? [];
                    return (
                      <div
                        key={d.toISOString()}
                        className={`relative border-l border-forest/10 ${isToday ? 'bg-forest/[0.04]' : ''}`}
                        style={{ height: hours.length * HOUR_PX }}
                      >
                        {/* Hour lines */}
                        {hours.map(h => (
                          <div
                            key={h}
                            className="absolute left-0 right-0 border-t border-forest/10"
                            style={{ top: (h - GRID_START_MIN / 60) * HOUR_PX }}
                          />
                        ))}
                        {/* Slot blocks */}
                        {list.map(s => {
                          const top = Math.max(0, (minutesSinceMidnight(s.startsAt) - GRID_START_MIN) / 60 * HOUR_PX);
                          const bottom = Math.min(hours.length * HOUR_PX, (minutesSinceMidnight(s.endsAt) - GRID_START_MIN) / 60 * HOUR_PX);
                          const full = s.remaining <= 0 && !s.mine;
                          const active = selected === s.id;
                          return (
                            <button
                              key={s.id}
                              disabled={full}
                              onClick={() => setSelected(s.id)}
                              className={`absolute left-1 right-1 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition-colors ${
                                active
                                  ? 'bg-forest text-cream shadow'
                                  : full
                                    ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                                    : s.mine
                                      ? 'bg-[#C4622D]/20 text-forest ring-1 ring-[#C4622D]'
                                      : 'bg-forest/15 text-forest hover:bg-forest/25'
                              }`}
                              style={{ top, height: Math.max(28, bottom - top) }}
                              title={s.note ?? ''}
                            >
                              <span className="font-semibold">
                                {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}
                              </span>
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

            {/* ── Confirm bar ───────────────────────────────── */}
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
              <button
                onClick={confirm}
                disabled={!selected || saving}
                className="shrink-0 rounded-md bg-cream px-5 py-2 text-sm font-semibold text-forest disabled:opacity-50"
              >
                {saving ? 'Booking…' : data.currentSlotId ? 'Change my slot' : 'Confirm slot'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
