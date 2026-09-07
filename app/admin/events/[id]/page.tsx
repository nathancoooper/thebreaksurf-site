'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/admin/ImageUpload';
import type { Event } from '@/types';

const COORD_PAIR = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/events/${id}`)
      .then(r => r.json())
      .then((ev: Event) => {
        setName(ev.name);
        setDate(ev.date ? ev.date.slice(0, 10) : '');
        setLocation(ev.location);
        setLat(ev.lat != null ? String(ev.lat) : '');
        setLng(ev.lng != null ? String(ev.lng) : '');
        setDescription(ev.description ?? '');
        setCover(ev.cover ?? '');
        setLoading(false);
      });
  }, [id]);

  // Pasting "lat, lng" (e.g. copied from Google Maps) into the lat field splits it into both fields.
  function handleLatPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const match = e.clipboardData.getData('text').match(COORD_PAIR);
    if (!match) return;
    e.preventDefault();
    setLat(match[1]);
    setLng(match[2]);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/admin/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, date: date ? new Date(date).toISOString() : '', location, lat: lat ? parseFloat(lat) : undefined, lng: lng ? parseFloat(lng) : undefined, description, cover }),
    });
    if (res.ok) {
      router.push('/admin/events');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Edit event</h1>
          <p className="mt-0.5 font-mono text-xs text-gray-400">{id}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/events')} className="text-sm text-gray-500 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#C4622D] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="mx-auto max-w-xl">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Event name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Map coordinates</label>
              <p className="mt-0.5 text-xs text-gray-400">Right-click the exact spot on Google Maps → &ldquo;What&rsquo;s here?&rdquo; to copy the coordinates.</p>
              <div className="mt-1.5 flex gap-2">
                <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} onPaste={handleLatPaste}
                  placeholder="Lat e.g. 50.2146"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]" />
                <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)}
                  placeholder="Lng e.g. -5.4756"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]" />
            </div>
            <ImageUpload label="Cover image" value={cover} onChange={setCover} meta={{ type: 'events', name, date }} />
          </div>
        </div>
      </div>
    </div>
  );
}
