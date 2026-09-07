'use client';

import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';

interface Account {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  hasTillPin?: boolean;
  createdAt: string;
}

interface TotpProvisioning {
  qrDataUrl: string;
  totpSecret: string;
}

function generatePassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const random = crypto.getRandomValues(new Uint32Array(14));
  for (let i = 0; i < 14; i++) out += alphabet[random[i] % alphabet.length];
  return out;
}

export default function UserManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newTillPin, setNewTillPin] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSaved, setActionSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [provisioning, setProvisioning] = useState<TotpProvisioning | null>(null);
  const [createError, setCreateError] = useState('');

  async function load() {
    const res = await fetch('/api/admin/team', { credentials: 'include' });
    if (res.ok) setAccounts((await res.json()).accounts ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function resetFeedback() {
    setActionError('');
    setActionSaved(false);
  }

  async function createAccount() {
    resetFeedback();
    setCreateError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), email: createEmail.trim(), password: createPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not create the account');
      setProvisioning({ qrDataUrl: data.qrDataUrl, totpSecret: data.totpSecret });
      setCreateName(''); setCreateEmail(''); setCreatePassword('');
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function patchAccount(id: string, body: Record<string, unknown>, onTotp?: (t: TotpProvisioning) => void) {
    resetFeedback();
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      if (data.totpReset && onTotp) onTotp(data.totpReset);
      await load();
      setActionSaved(true);
      setTimeout(() => setActionSaved(false), 2500);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(account: Account) {
    if (!confirm(`Remove ${account.name} (${account.email})? They will immediately lose access.`)) return;
    resetFeedback();
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/team/${account.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Delete failed');
      }
      if (expandedId === account.id) setExpandedId(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Users</h2>
        <p className="text-sm text-gray-500">Accounts for this panel — create logins, reset passwords, re-provision two-factor, issue till PINs.</p>
      </div>

      {(actionError || actionSaved) && (
        <div className="mb-4">
          {actionError && <p className="text-xs text-red-600">{actionError}</p>}
          {actionSaved && <p className="flex items-center gap-1 text-xs font-medium text-green-700"><FontAwesomeIcon icon={faCheck} className="w-3" /> Saved</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="divide-y divide-gray-100">
          {accounts.map(account => (
            <div key={account.id}>
              <button
                type="button"
                onClick={() => { setExpandedId(current => current === account.id ? null : account.id); setNewPassword(''); setNewTillPin(''); resetFeedback(); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <span className="truncate">{account.name}</span>
                    {account.role === 'owner' && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Owner</span>
                    )}
                    {account.hasTillPin && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Till PIN</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-gray-400">{account.email}</p>
                </div>
                <FontAwesomeIcon icon={faChevronDown} className={`w-3 shrink-0 text-gray-400 transition-transform ${expandedId === account.id ? 'rotate-180' : ''}`} />
              </button>

              {expandedId === account.id && (
                <div className="space-y-3 border-t border-gray-100 bg-gray-50 px-4 py-4">
                  <div>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Till PIN</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newTillPin}
                        onChange={event => setNewTillPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder={account.hasTillPin ? 'Replace PIN (4–8 digits)' : 'PIN for the till (4–8 digits)'}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                      />
                      <button
                        type="button"
                        disabled={busy || !/^\d{4,8}$/.test(newTillPin)}
                        onClick={() => { void patchAccount(account.id, { tillPin: newTillPin }); setNewTillPin(''); }}
                        className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                      >
                        Save
                      </button>
                      {account.hasTillPin && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchAccount(account.id, { clearTillPin: true })}
                          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">Unlocks terminal.thebreaksurf.co.uk — sales booked while it&apos;s in use are stamped with this name.</p>
                  </div>

                  {account.role !== 'owner' && (
                    <>
                      <div>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Reset password</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newPassword}
                            onChange={event => setNewPassword(event.target.value)}
                            placeholder="New password (min 8 characters)"
                            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                          />
                          <button
                            type="button"
                            onClick={() => setNewPassword(generatePassword())}
                            className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            Generate
                          </button>
                          <button
                            type="button"
                            disabled={busy || newPassword.length < 8}
                            onClick={() => { void patchAccount(account.id, { newPassword }); setNewPassword(''); }}
                            className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                          >
                            Save
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchAccount(account.id, { resetTotp: true }, setProvisioning)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                        >
                          Reset two-factor
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeAccount(account)}
                          className="ml-auto text-xs font-medium text-gray-400 hover:text-red-600 disabled:opacity-40"
                        >
                          Remove account
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 px-4 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">New account</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              type="text"
              value={createName}
              onChange={event => setCreateName(event.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
            <input
              type="email"
              value={createEmail}
              onChange={event => setCreateEmail(event.target.value)}
              placeholder="Email address"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={createPassword}
                onChange={event => setCreatePassword(event.target.value)}
                placeholder="Temp password"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
              <button
                type="button"
                onClick={() => setCreatePassword(generatePassword())}
                className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                title="Generate password"
              >
                Generate
              </button>
            </div>
          </div>
          {createError && <p className="mt-2 text-xs text-red-600">{createError}</p>}
          <button
            type="button"
            disabled={busy || !createName.trim() || !createEmail.trim() || createPassword.length < 8}
            onClick={() => void createAccount()}
            className="mt-3 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 sm:w-auto"
          >
            {busy ? 'Working…' : 'Create account'}
          </button>
        </div>
      </div>

      {provisioning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 p-6" onClick={() => setProvisioning(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">Set up two-factor</h3>
            <p className="mt-1 text-xs text-gray-500">
              Have them scan this with their authenticator app <span className="font-medium text-gray-700">before</span> handing over the login — it won&apos;t be shown again.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={provisioning.qrDataUrl} alt="Two-factor QR code" className="mx-auto mt-4 h-48 w-48" />
            <p className="mt-3 break-all rounded-lg bg-gray-50 p-2 text-center font-mono text-xs text-gray-600">{provisioning.totpSecret}</p>
            <button
              type="button"
              onClick={() => setProvisioning(null)}
              className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
