'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Logo from '@/components/Logo';

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

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function PickupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PickupData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const now = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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
        if (d.currentSlotId) {
          setSelected(d.currentSlotId);
          const mine = (d.slots as SlotOption[]).find((s: SlotOption) => s.id === d.currentSlotId);
          if (mine) {
            const dt = new Date(mine.startsAt);
            setMonthCursor({ y: dt.getFullYear(), m: dt.getMonth() });
            setSelectedDay(dayKey(dt));
          }
        }
      })
      .catch(() => setInvalid(true));
  }, [token]);

  // Days in the visible month that have at least one bookable (or mine) future slot.
  const { cells, availableDays, daySlots } = useMemo(() => {
    const { y, m } = monthCursor;
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7; // Mon-first offset
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const available = new Set<string>();
    const byDay = new Map<string, SlotOption[]>();
    const t = new Date();
    for (const s of data?.slots ?? []) {
      const start = new Date(s.startsAt);
      if (start < t) continue;
      const k = dayKey(start);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(s);
      if (s.remaining > 0 || s.mine) available.add(k);
    }
    for (const list of byDay.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return { cells, availableDays: available, daySlots: byDay };
  }, [monthCursor, data]);

  const horizonMonth = useMemo(() => {
    const h = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
    return { y: h.getFullYear(), m: h.getMonth() };
  }, [now]);
  const canPrev = monthCursor.y > now.getFullYear() || (monthCursor.y === now.getFullYear() && monthCursor.m > now.getMonth());
  const canNext = monthCursor.y < horizonMonth.y || (monthCursor.y === horizonMonth.y && monthCursor.m < horizonMonth.m);

  const visibleSlots = (selectedDay && daySlots.get(selectedDay)) || [];
  const selectedSlot = data?.slots.find(s => s.id === selected) ?? null;

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

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      {/* ── Co-branded header, copied from the /university navbar lockup ── */}
      <header className="shrink-0 border-b border-charcoal/10 bg-cream">
        <div className="flex items-center justify-center gap-3 px-4 py-5">
          <Logo className="h-8 w-auto text-charcoal/80" />
          <span className="text-sm text-charcoal/40">x</span>
          <div
            role="img"
            aria-label="Arts University Bournemouth"
            className="h-5 w-[6.5rem] bg-charcoal/80"
            style={{
              WebkitMaskImage: 'url(/images/aub-logo-white.svg)',
              maskImage: 'url(/images/aub-logo-white.svg)',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        {invalid ? (
          <p className="rounded-sm border border-charcoal/10 bg-white p-8 text-sm text-charcoal/60">
            This pick-up link isn&apos;t recognised. Ask us for a fresh one.
          </p>
        ) : !data ? (
          <p className="text-sm text-charcoal/50">Loading…</p>
        ) : done ? (
          <div className="mx-auto max-w-lg rounded-sm border border-charcoal/10 bg-white p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-forest text-xl text-cream">✓</div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-charcoal">You&apos;re booked in</h1>
            <p className="mt-2 text-sm text-gray-600">
              {fmtLong(done.startsAt)} · {fmtTime(done.startsAt)} – {fmtTime(done.endsAt)}
              {done.note ? ` · ${done.note}` : ''}
            </p>
            <p className="mt-1 text-xs text-gray-400">Bring your name — we&apos;ll have your {data.garment} ready.</p>
          </div>
        ) : (
          <div className="grid gap-6 rounded-sm border border-charcoal/10 bg-white p-6 md:grid-cols-[240px_1fr] md:p-8">
            {/* ── Event details (cal.com left rail) ── */}
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-charcoal/40">{data.studentName}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-charcoal">Pick up your garment</h1>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/60">
                Your <strong className="font-medium text-charcoal">{data.garment}</strong> is ready.
              </p>
              <div className="mt-4 space-y-1 text-sm text-charcoal/60">
                <p>One hour slots</p>
                <p>Arts University Bournemouth</p>
              </div>
              {data.currentSlotId && !done && (
                <p className="mt-4 rounded-sm bg-moss/10 px-3 py-2 text-xs leading-relaxed text-forest">
                  You already have a booking — picking a new time moves it.
                </p>
              )}
            </div>

            {/* ── Month + times ── */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-lg font-bold tracking-tight text-charcoal">
                    {new Date(monthCursor.y, monthCursor.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setMonthCursor(c => ({ y: c.m === 0 ? c.y - 1 : c.y, m: (c.m + 11) % 12 }))}
                      disabled={!canPrev} aria-label="Previous month"
                      className="rounded-sm border border-charcoal/20 px-2.5 py-0.5 text-charcoal transition-colors hover:border-charcoal/50 disabled:opacity-30">‹</button>
                    <button onClick={() => setMonthCursor(c => ({ y: c.m === 11 ? c.y + 1 : c.y, m: (c.m + 1) % 12 }))}
                      disabled={!canNext} aria-label="Next month"
                      className="rounded-sm border border-charcoal/20 px-2.5 py-0.5 text-charcoal transition-colors hover:border-charcoal/50 disabled:opacity-30">›</button>
                  </div>
                </div>
                <div className="grid grid-cols-7 text-center text-[11px] font-medium text-charcoal/40">
                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <div key={d} className="py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 text-center text-sm">
                  {cells.map((d, i) => {
                    if (!d) return <div key={`x${i}`} />;
                    const k = dayKey(d);
                    const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const open = availableDays.has(k) && !isPast;
                    const active = selectedDay === k;
                    return (
                      <button
                        key={k}
                        disabled={!open}
                        onClick={() => { setSelectedDay(k); setSelected(null); }}
                        className={`mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-sm transition-colors ${
                          active
                            ? 'bg-forest font-semibold text-cream'
                            : open
                              ? 'font-medium text-charcoal hover:bg-charcoal/5'
                              : 'text-charcoal/25'
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-lg font-bold tracking-tight text-charcoal">
                  {selectedDay
                    ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                    : 'Pick a day'}
                </p>
                {!selectedDay ? (
                  <p className="text-sm text-charcoal/50">Available days are shown in dark.</p>
                ) : visibleSlots.length === 0 ? (
                  <p className="text-sm text-charcoal/50">Nothing bookable this day.</p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {visibleSlots.map(s => {
                      const full = s.remaining <= 0 && !s.mine;
                      const active = selected === s.id;
                      return (
                        <button
                          key={s.id}
                          disabled={full}
                          onClick={() => setSelected(s.id)}
                          className={`w-full rounded-sm border px-3 py-2.5 text-sm transition-colors ${
                            active
                              ? 'border-forest bg-moss/25 text-forest'
                              : full
                                ? 'cursor-not-allowed border-charcoal/10 bg-charcoal/5 text-charcoal/30'
                                : 'border-charcoal/20 bg-white text-charcoal hover:border-charcoal/60'
                          }`}
                        >
                          <span className="font-medium">{fmtTime(s.startsAt)} – {fmtTime(s.endsAt)}</span>
                          <span className="ml-2 text-xs text-charcoal/40">
                            {s.mine ? '· yours' : full ? '· full' : `· ${s.remaining} left`}
                          </span>
                          {s.note && <span className="block text-xs text-charcoal/40">{s.note}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <button
                  onClick={confirm}
                  disabled={!selected || saving}
                  className="mt-3 w-full rounded-sm border border-forest bg-forest py-2.5 text-sm font-medium text-cream transition-all hover:bg-moss disabled:opacity-40"
                >
                  {saving ? 'Booking…' : data.currentSlotId ? 'Change my slot' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
