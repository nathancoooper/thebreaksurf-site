'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Event } from '@/types';
import GradientPlaceholder from '@/components/GradientPlaceholder';

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/admin/events');
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
    load();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Events</h1>
        <button
          onClick={() => router.push('/admin/events/new')}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Add event
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">No events yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map(ev => (
                <tr key={ev.id} className="hover:bg-gray-50">
                  <td className="flex items-center gap-3 px-5 py-3.5">
                    {ev.cover ? (
                      <img
                        src={ev.cover}
                        alt={ev.name}
                        className="h-10 w-10 rounded-md object-cover bg-gray-100"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <GradientPlaceholder seed={ev.id} className="h-10 w-10 shrink-0 rounded-md" />
                    )}
                    <span className="font-medium text-gray-900">{ev.name}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(ev.date)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{ev.location}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => router.push(`/admin/events/${ev.id}`)}
                      className="mr-4 text-[#C4622D] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id, ev.name)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
