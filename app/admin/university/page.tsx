'use client';

import { useEffect, useState } from 'react';
import { UniversitySubmission } from '@/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Filter = 'pending' | 'completed';

export default function UniversityPage() {
  const [submissions, setSubmissions] = useState<UniversitySubmission[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/university').then(r => r.json()).then(data => {
      setSubmissions(data);
      setLoading(false);
    });
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
                    <button
                      onClick={() => setCompleted(s.id, false)}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Mark pending
                    </button>
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
