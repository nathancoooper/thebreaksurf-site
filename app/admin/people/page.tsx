'use client';

import { useEffect, useRef, useState } from 'react';

interface Person {
  id: string;
  name: string;
  role: string;
  email: string;
  createdAt: string;
  source: 'person' | 'contact';
}

const ROLES = ['Director', 'Artist', 'Photographer', 'Freelancer', 'Customer', 'Other'];

const ROLE_STYLE: Record<string, string> = {
  Director:      'bg-purple-50 text-purple-600 border-purple-200',
  Artist:        'bg-pink-50 text-pink-600 border-pink-200',
  Photographer:  'bg-blue-50 text-blue-600 border-blue-200',
  Freelancer:    'bg-orange-50 text-orange-600 border-orange-200',
  Customer:      'bg-teal-50 text-teal-600 border-teal-200',
  Other:         'bg-gray-100 text-gray-500 border-gray-200',
};

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ name }: { name: string }) {
  const colours = ['bg-orange-400', 'bg-blue-400', 'bg-green-500', 'bg-pink-400', 'bg-indigo-400'];
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white ${colours[name.charCodeAt(0) % colours.length]}`}>
      {initials(name)}
    </span>
  );
}

const BLANK = { name: '', role: 'Other', email: '' };

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Person | 'new' | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch('/api/admin/people', { credentials: 'include' });
    if (res.ok) setPeople(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!modal) return;
    setTimeout(() => nameRef.current?.focus(), 50);
    if (modal === 'new') setForm(BLANK);
    else setForm({ name: modal.name, role: modal.role, email: modal.email });
  }, [modal]);

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (modal === 'new') {
      await fetch('/api/admin/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
    } else if (modal) {
      await fetch(`/api/admin/people/${modal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
    }
    await load();
    setSaving(false);
    setModal(null);
  }

  async function remove(id: string) {
    if (!confirm('Remove this person?')) return;
    await fetch(`/api/admin/people/${id}`, { method: 'DELETE', credentials: 'include' });
    await load();
    setModal(null);
  }

  function openModal(p: Person) {
    if (p.source === 'contact') return; // contacts are managed via email
    setModal(p);
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">People</h1>
        <button
          onClick={() => setModal('new')}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Add person
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center">
          <p className="text-sm text-gray-500">No people yet</p>
          <p className="text-xs text-gray-400">Add team members, clients, and collaborators</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {people.map(p => (
            <button
              key={p.id}
              onClick={() => openModal(p)}
              className="flex w-full items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                {p.email && <p className="text-xs text-gray-400">{p.email}</p>}
              </div>
              {p.source === 'contact' && (
                <span className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-400">Contact</span>
              )}
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${ROLE_STYLE[p.role] ?? ROLE_STYLE.Other}`}>
                {p.role}
              </span>
            </button>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="mb-5 text-base font-semibold text-gray-900">
              {modal === 'new' ? 'Add person' : 'Edit person'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') save(); }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  placeholder="optional"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Role</label>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        form.role === r ? (ROLE_STYLE[r] ?? ROLE_STYLE.Other) : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {modal !== 'new' ? (
                <button onClick={() => remove((modal as Person).id)} className="text-xs text-red-400 hover:text-red-600">
                  Remove
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button onClick={() => setModal(null)} className="rounded-md border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving || !form.name.trim()}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
