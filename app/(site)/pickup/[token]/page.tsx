'use client';

import { use, useEffect, useState } from 'react';

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

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function fmtDay(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function PickupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PickupData | null>(null);
  const [invalid, setInvalid] = useState(false);
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
    const slot = data.slots.find(s => s.id === selected) ?? null;
    setDone(slot);
  }

  // Group slots by calendar day across the next 7 days.
  const days: { key: string; label: string; slots: SlotOption[] }[] = [];
  if (data) {
    const seen = new Map<string, SlotOption[]>();
    for (const s of data.slots) {
      const k = dayKey(s.startsAt);
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k)!.push(s);
    }
    for (const d = new Date(); days.length < 7; d.setDate(d.getDate() + 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ key: k, label: fmtDay(k), slots: seen.get(k) ?? [] });
    }
  }

  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-forest/60">The Break × AUB</p>
        <h1 className="mt-2 text-3xl font-semibold text-forest">Pick up your garment</h1>

        {invalid ? (
          <p className="mt-6 rounded-lg bg-white p-6 text-sm text-gray-600">
            This pick-up link isn&apos;t recognised. Ask us for a fresh one.
          </p>
        ) : !data ? (
          <p className="mt-6 text-sm text-forest/60">Loading your slots…</p>
        ) : done ? (
          <div className="mt-6 rounded-lg bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-forest">You&apos;re booked in ✓</p>
            <p className="mt-2 text-sm text-gray-600">
              {fmtDay(dayKey(done.startsAt))} · {fmtTime(done.startsAt)} – {fmtTime(done.endsAt)}
              {done.note ? ` · ${done.note}` : ''}
            </p>
            <p className="mt-1 text-xs text-gray-400">Bring this page or your name — we&apos;ll have your {data.garment} ready.</p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-forest/70">
              Hi {data.studentName} — your <strong>{data.garment}</strong> is ready. Choose a slot below
              {data.currentSlotId ? ' (or change your current booking)' : ''}:
            </p>

            <div className="mt-6 space-y-5">
              {days.map(day => (
                <div key={day.key} className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-forest">{day.label}</p>
                  {day.slots.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-400">No pick-up windows this day.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {day.slots.map(s => {
                        const full = s.remaining <= 0 && !s.mine;
                        const active = selected === s.id;
                        return (
                          <button
                            key={s.id}
                            disabled={full}
                            onClick={() => setSelected(s.id)}
                            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                              active
                                ? 'border-forest bg-forest text-cream'
                                : full
                                  ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                                  : 'border-gray-200 bg-white text-gray-800 hover:border-forest'
                            }`}
                          >
                            {fmtTime(s.startsAt)} – {fmtTime(s.endsAt)}
                            <span className="ml-2 text-xs opacity-70">
                              {s.mine ? '· yours' : full ? '· full' : `· ${s.remaining} left`}
                            </span>
                            {s.note && <span className="block text-[11px] opacity-60">{s.note}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <button
              onClick={confirm}
              disabled={!selected || saving}
              className="mt-6 w-full rounded-md bg-forest py-3 text-sm font-semibold text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Booking…' : data.currentSlotId ? 'Change my slot' : 'Confirm my slot'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
