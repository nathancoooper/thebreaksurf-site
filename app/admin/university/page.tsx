'use client';

import { useEffect, useState } from 'react';
import { PickupSlotWithCount, UniversitySubmission } from '@/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSlot(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Filter = 'pending' | 'completed';

export default function UniversityPage() {
  const [submissions, setSubmissions] = useState<UniversitySubmission[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<PickupSlotWithCount[]>([]);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotDate, setSlotDate] = useState('');
  const [slotTime, setSlotTime] = useState('');
  const [slotLength, setSlotLength] = useState('60');
  const [slotCapacity, setSlotCapacity] = useState('8');
  const [slotNote, setSlotNote] = useState('');
  const [pickupLinks, setPickupLinks] = useState<Record<string, { url: string; emailed: boolean }>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/university').then(r => r.json()).then(data => {
      setSubmissions(data);
      setLoading(false);
    });
    fetch('/api/admin/pickup-slots').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSlots(data);
    }).catch(() => {});
  }, []);

  async function setCompleted(id: string, completed: boolean) {
    await fetch(`/api/admin/university/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, completed } : s));
  }

  async function deleteSubmission(id: string) {
    await fetch(`/api/admin/university/${id}`, { method: 'DELETE' });
    setSubmissions(prev => prev.filter(s => s.id !== id));
  }

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!slotDate || !slotTime) return;
    const startsAt = new Date(`${slotDate}T${slotTime}`);
    const endsAt = new Date(startsAt.getTime() + Number(slotLength) * 60_000);
    const res = await fetch('/api/admin/pickup-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), capacity: Number(slotCapacity), note: slotNote }),
    });
    if (!res.ok) return;
    const slot = await res.json();
    setSlots(prev => [...prev, slot].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    setShowSlotForm(false);
    setSlotDate(''); setSlotTime(''); setSlotNote('');
  }

  async function deleteSlot(id: string) {
    await fetch(`/api/admin/pickup-slots/${id}`, { method: 'DELETE' });
    setSlots(prev => prev.filter(s => s.id !== id));
  }

  async function sendPickupLink(id: string) {
    setSendingId(id);
    try {
      const res = await fetch(`/api/admin/university/${id}/ready`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.pickupUrl) {
        setPickupLinks(prev => ({ ...prev, [id]: { url: data.pickupUrl, emailed: data.emailed } }));
      }
    } finally {
      setSendingId(null);
    }
  }

  const visible = submissions.filter(s => filter === 'completed' ? s.completed : !s.completed);
  const counts = {
    pending: submissions.filter(s => !s.completed).length,
    completed: submissions.filter(s => s.completed).length,
  };

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">University collab drop-offs</h1>
      <p className="mb-6 text-sm text-gray-500">Garments submitted via the university embroidery drop-off form.</p>

      <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['pending', 'completed'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {f}
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
              f === 'pending' && counts.pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Pick-up slots (V001) ─────────────────────────── */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Pick-up slots</h2>
            <p className="text-xs text-gray-500">Students pick one in the 7-day view from their emailed link.</p>
          </div>
          <button
            onClick={() => setShowSlotForm(v => !v)}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {showSlotForm ? 'Cancel' : '+ Add slot'}
          </button>
        </div>

        {showSlotForm && (
          <form onSubmit={createSlot} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="text-xs text-gray-500">Date
              <input type="date" required value={slotDate} onChange={e => setSlotDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
            </label>
            <label className="text-xs text-gray-500">Start
              <input type="time" required value={slotTime} onChange={e => setSlotTime(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
            </label>
            <label className="text-xs text-gray-500">Length (min)
              <input type="number" min={15} max={480} step={15} value={slotLength} onChange={e => setSlotLength(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
            </label>
            <label className="text-xs text-gray-500">Capacity
              <input type="number" min={1} max={200} value={slotCapacity} onChange={e => setSlotCapacity(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
            </label>
            <label className="text-xs text-gray-500">Location (optional)
              <input type="text" value={slotNote} onChange={e => setSlotNote(e.target.value)} placeholder="SU foyer"
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
            </label>
            <div className="col-span-2 sm:col-span-5">
              <button type="submit" className="rounded-md bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700">
                Create slot
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-2">
          {slots.length === 0 && <p className="text-xs text-gray-400">No slots yet.</p>}
          {slots.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-gray-900">{formatSlot(s.startsAt)}</span>
                <span className="text-gray-400"> → {new Date(s.endsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                {s.note && <span className="ml-2 text-xs text-gray-500">· {s.note}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`text-xs font-semibold ${s.booked >= s.capacity ? 'text-red-600' : 'text-gray-500'}`}>
                  {s.booked}/{s.capacity} booked
                </span>
                <button onClick={() => deleteSlot(s.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400">No {filter} drop-offs.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(s => (
            <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-gray-900">{s.studentName}</p>
                    <span className="text-xs text-gray-400">{s.studentEmail}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{formatDate(s.createdAt)}</p>

                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-gray-400">Garment</dt>
                      <dd className="text-gray-800">{s.garment}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">Placement</dt>
                      <dd className="text-gray-800">{s.placement}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">Colour</dt>
                      <dd className="text-gray-800">{s.colour}</dd>
                    </div>
                  </dl>
                  {s.note && (
                    <p className="mt-3 text-sm text-gray-700 leading-relaxed">{s.note}</p>
                  )}
                  {s.photo && (
                    <a href={s.photo} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block">
                      <img src={s.photo} alt="Placement photo" className="h-24 w-24 rounded-md border border-gray-200 object-cover" />
                    </a>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  {s.completed ? (
                    <>
                      <button
                        onClick={() => setCompleted(s.id, false)}
                        className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Mark pending
                      </button>
                      {pickupLinks[s.id] ? (
                        <div className="max-w-56 rounded-md border border-green-200 bg-green-50 p-2 text-xs">
                          <p className={pickupLinks[s.id].emailed ? 'text-green-700' : 'text-amber-700'}>
                            {pickupLinks[s.id].emailed ? 'Link emailed ✓' : 'Email failed — copy manually:'}
                          </p>
                          <button
                            onClick={() => { void navigator.clipboard.writeText(pickupLinks[s.id].url); }}
                            className="mt-1 break-all text-left text-gray-600 underline hover:text-gray-900"
                            title="Click to copy"
                          >
                            {pickupLinks[s.id].url}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => sendPickupLink(s.id)}
                          disabled={sendingId === s.id}
                          className="rounded-md bg-[#C4622D] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                        >
                          {sendingId === s.id ? 'Sending…' : 'Send pick-up link'}
                        </button>
                      )}
                      {s.pickupSlotId && (
                        <p className="text-xs text-gray-500">
                          Booked: {(() => {
                            const slot = slots.find(x => x.id === s.pickupSlotId);
                            return slot ? formatSlot(slot.startsAt) : 'a deleted slot';
                          })()}
                        </p>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => setCompleted(s.id, true)}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Mark done
                    </button>
                  )}
                  <button
                    onClick={() => deleteSubmission(s.id)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
