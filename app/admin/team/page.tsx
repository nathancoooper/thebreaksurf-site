'use client';

import { useEffect, useState } from 'react';
import { NAV, PERMISSION_GROUPS } from '@/components/admin/AdminLayoutClient';

interface Account {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  permissions: string[];
  createdAt: string;
}

function PermissionChecklist({ selected, onToggle }: { selected: string[]; onToggle: (href: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
      {PERMISSION_GROUPS.map(group => {
        const items = NAV.filter(i => i.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group}</p>
            <div className="space-y-1">
              {items.map(item => (
                <label key={item.href} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.href)}
                    onChange={() => onToggle(item.href)}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TotpReveal({ qrDataUrl, totpSecret, onDone }: { qrDataUrl: string; totpSecret: string; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-sm font-semibold text-gray-900">Set up on their device</h3>
        <p className="mt-2 text-xs text-gray-500">
          Have them scan this QR code (or enter the secret manually) in an authenticator app — this is only shown once.
        </p>
        <div className="mt-4 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="2FA QR code" className="h-40 w-40" />
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-xs tracking-widest text-gray-600">{totpSecret}</p>
        </div>
        <button
          onClick={onDone}
          className="mt-6 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [reveal, setReveal] = useState<{ qrDataUrl: string; totpSecret: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/admin/team', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setAccounts(data.accounts ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function resetCreateForm() {
    setName(''); setEmail(''); setPassword(''); setPermissions([]); setError('');
  }

  async function createMember() {
    if (!name.trim() || !email.trim() || !password.trim()) { setError('Name, email and password are required.'); return; }
    setCreating(true);
    setError('');
    try {
      const r = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, permissions }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? 'Failed to create account.'); return; }
      setShowCreate(false);
      resetCreateForm();
      setReveal({ qrDataUrl: data.qrDataUrl, totpSecret: data.totpSecret });
      load();
    } finally {
      setCreating(false);
    }
  }

  async function updatePermissions(id: string, next: string[]) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, permissions: next } : a));
    await fetch(`/api/admin/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ permissions: next }),
    });
  }

  async function resetTotp(id: string) {
    const r = await fetch(`/api/admin/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ resetTotp: true }),
    });
    const data = await r.json();
    if (data.totpReset) setReveal(data.totpReset);
  }

  async function resetPassword(id: string) {
    const newPassword = prompt('New temporary password (min 8 characters):');
    if (!newPassword) return;
    await fetch(`/api/admin/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newPassword }),
    });
  }

  async function removeAccount(id: string, name: string) {
    if (!confirm(`Remove ${name}'s account? They'll no longer be able to sign in.`)) return;
    setAccounts(prev => prev.filter(a => a.id !== id));
    await fetch(`/api/admin/team/${id}`, { method: 'DELETE', credentials: 'include' });
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Team</h1>
          <p className="text-sm text-gray-400">Create accounts for teammates and control which pages they can see.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Add team member
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && (
        <div className="max-w-3xl space-y-3">
          {accounts.map(a => {
            const isEditing = editingId === a.id;
            return (
              <div key={a.id} className="rounded-2xl border border-gray-100 bg-white">
                <div className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.role === 'owner' ? (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">Owner — full access</span>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400">{a.permissions.length} page{a.permissions.length !== 1 ? 's' : ''}</span>
                        <button onClick={() => setEditingId(isEditing ? null : a.id)} className="text-xs font-medium text-gray-600 hover:text-gray-900">
                          {isEditing ? 'Done' : 'Permissions'}
                        </button>
                        <button onClick={() => resetPassword(a.id)} className="text-xs text-gray-400 hover:text-gray-700">Reset password</button>
                        <button onClick={() => resetTotp(a.id)} className="text-xs text-gray-400 hover:text-gray-700">Reset 2FA</button>
                        <button onClick={() => removeAccount(a.id, a.name)} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
                      </>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div className="border-t border-gray-100 p-5">
                    <PermissionChecklist
                      selected={a.permissions}
                      onToggle={href => {
                        const next = a.permissions.includes(href) ? a.permissions.filter(p => p !== href) : [...a.permissions, href];
                        updatePermissions(a.id, next);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Add team member</h2>
              <button onClick={() => { setShowCreate(false); resetCreateForm(); }} className="text-gray-400 hover:text-gray-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-auto p-6">
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Name</span>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Email</span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Temporary password</span>
                <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 8 characters" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none" />
              </label>
              <div>
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pages they can access</span>
                <PermissionChecklist
                  selected={permissions}
                  onToggle={href => setPermissions(prev => prev.includes(href) ? prev.filter(p => p !== href) : [...prev, href])}
                />
              </div>
            </div>
            <div className="border-t border-gray-100 px-6 py-4">
              <button
                onClick={createMember}
                disabled={creating}
                className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {creating ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reveal && (
        <TotpReveal qrDataUrl={reveal.qrDataUrl} totpSecret={reveal.totpSecret} onDone={() => setReveal(null)} />
      )}
    </div>
  );
}
