'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Meeting {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  status: 'pending' | 'uploaded' | 'compressing' | 'ready' | 'error';
  videoPath: string | null;
  compressedPath: string | null;
}

const TEAM = ['Nathan Cooper', 'Archie Ellis', 'Daniel Harris', 'Thomas Billson'];

function Avatar({ name }: { name: string }) {
  const colours = ['bg-orange-400', 'bg-blue-400', 'bg-green-500', 'bg-pink-400', 'bg-indigo-400'];
  const idx = name.charCodeAt(0) % colours.length;
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  return (
    <span title={name} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${colours[idx]}`}>
      {initials}
    </span>
  );
}

interface Whiteboard {
  id: string;
  name: string;
  thumbnail?: string;
}

function CreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (title: string, date: string, attendees: string[], whiteboardId: string | null) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [whiteboardId, setWhiteboardId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch('/api/admin/whiteboards', { credentials: 'include' })
      .then(r => r.json()).then(setWhiteboards).catch(() => {});
  }, []);

  function toggle(name: string) {
    setAttendees(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  function addCustom() {
    const name = customInput.trim();
    if (!name || attendees.includes(name)) return;
    setAttendees(prev => [...prev, name]);
    setCustomInput('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onCreate(title.trim(), date, attendees, whiteboardId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-sm font-semibold text-gray-900">New Meeting</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Title</label>
            <input
              ref={inputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Summer Review"
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Attendees</label>
            <div className="flex flex-wrap gap-2">
              {TEAM.map(name => {
                const sel = attendees.includes(name);
                return (
                  <button key={name} type="button" onClick={() => toggle(name)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${sel ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'}`}>
                    {name}
                  </button>
                );
              })}
              {/* Custom attendees added via input */}
              {attendees.filter(a => !TEAM.includes(a)).map(name => (
                <span key={name} className="flex items-center gap-1 rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-sm text-white">
                  {name}
                  <button type="button" onClick={() => toggle(name)} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                placeholder="Add someone else…"
                className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
              />
              <button type="button" onClick={addCustom} className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50">
                Add
              </button>
            </div>
          </div>
          {whiteboards.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs text-gray-500">Whiteboard</label>
              <div className="grid grid-cols-2 gap-2">
                {whiteboards.map(w => {
                  const sel = whiteboardId === w.id;
                  return (
                    <button key={w.id} type="button" onClick={() => setWhiteboardId(sel ? null : w.id)}
                      className={`rounded-md border p-1.5 text-left transition-colors ${sel ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}>
                      {w.thumbnail
                        ? <img src={w.thumbnail} alt={w.name} className="mb-1 h-16 w-full rounded object-cover" />
                        : <div className="mb-1 h-16 w-full rounded" style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                      }
                      <p className="truncate px-1 text-xs text-gray-700">{w.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

function MeetingCard({ m, onClick }: { m: Meeting; onClick: () => void }) {
  const hasVideo = !!(m.videoPath || m.compressedPath);
  const videoSrc = m.compressedPath ?? m.videoPath;

  return (
    <button onClick={onClick} className="group text-left">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
        {hasVideo ? (
          <>
            <video
              src={videoSrc ?? undefined}
              className="h-full w-full object-cover"
              preload="metadata"
              muted
              onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 1; }}
            />
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 text-gray-900">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
            {m.status === 'compressing' && (
              <div className="absolute bottom-2 left-2 rounded-full bg-yellow-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
                Compressing…
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-2.5">
        <p className="truncate text-sm font-medium text-gray-900 group-hover:text-gray-600 transition-colors">{m.title}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {new Date(m.date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </button>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch('/api/admin/meetings', { credentials: 'include' })
      .then(r => r.json())
      .then(setMeetings)
      .finally(() => setLoading(false));
  }, []);

  async function createMeeting(title: string, date: string, attendees: string[], whiteboardId: string | null) {
    const res = await fetch('/api/admin/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title, date, attendees, whiteboardId }),
    });
    const meeting = await res.json();
    router.push(`/admin/meetings/${meeting.id}`);
  }

  return (
    <div className="p-8">
      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreate={createMeeting} />}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Meetings</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          + New Meeting
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center">
          <p className="text-sm text-gray-500">No meetings yet</p>
          <p className="text-xs text-gray-400">Create one to start uploading recordings</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {meetings.map(m => (
            <MeetingCard key={m.id} m={m} onClick={() => router.push(`/admin/meetings/${m.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
