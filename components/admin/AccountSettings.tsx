'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

interface Account {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  createdAt: string;
}

interface LoginEntry {
  id: string;
  outcome: 'success' | 'failed_password' | 'failed_2fa';
  occurredAt: string;
  ipAddress: string;
  country?: string;
  userAgent: string;
}

interface PasskeySummary {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

type Notice = { type: 'ok' | 'error'; text: string } | null;

const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-gray-400';
const labelClass = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400';
const primaryButtonClass = 'rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50';

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p className={`rounded-lg border px-3 py-2 text-xs ${
      notice.type === 'ok'
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'border-red-200 bg-red-50 text-red-700'
    }`}>
      {notice.text}
    </p>
  );
}

function describeDevice(userAgent: string) {
  if (userAgent === 'Unknown device') return userAgent;
  const browser = userAgent.includes('Edg/') ? 'Edge'
    : userAgent.includes('Chrome/') ? 'Chrome'
      : userAgent.includes('Safari/') ? 'Safari'
        : userAgent.includes('Firefox/') ? 'Firefox'
          : 'Web browser';
  const platform = userAgent.includes('iPhone') ? 'iPhone'
    : userAgent.includes('iPad') ? 'iPad'
      : userAgent.includes('Macintosh') ? 'Mac'
        : userAgent.includes('Windows') ? 'Windows'
          : userAgent.includes('Android') ? 'Android'
            : '';
  return platform ? `${browser} on ${platform}` : browser;
}

export default function AccountSettings() {
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [totpPassword, setTotpPassword] = useState('');
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpNotice, setTotpNotice] = useState<Notice>(null);
  const [resettingTotp, setResettingTotp] = useState(false);

  const [loginEntries, setLoginEntries] = useState<LoginEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(true);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [passkeyNotice, setPasskeyNotice] = useState<Notice>(null);
  const [addingPasskey, setAddingPasskey] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/account', { credentials: 'include' }).then(response => response.json()),
      fetch('/api/admin/login-log', { credentials: 'include' }).then(response => response.json()),
      fetch('/api/admin/passkeys', { credentials: 'include' }).then(response => response.json()),
    ]).then(([accountData, logData, passkeyData]) => {
      if (accountData.account) {
        setAccount(accountData.account);
        setName(accountData.account.name);
        setEmail(accountData.account.email);
      }
      setLoginEntries(logData.entries ?? []);
      setPasskeys(passkeyData.passkeys ?? []);
    }).catch(() => {
      setProfileNotice({ type: 'error', text: 'Unable to load account settings.' });
    }).finally(() => setLoadingLog(false));
  }, []);

  async function addPasskey() {
    if (!window.PublicKeyCredential) {
      setPasskeyNotice({ type: 'error', text: 'Passkeys are not supported by this browser.' });
      return;
    }
    setAddingPasskey(true);
    setPasskeyNotice(null);
    try {
      const optionsResponse = await fetch('/api/admin/passkeys/register/options', { method: 'POST', credentials: 'include' });
      const optionsData = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(optionsData.error ?? 'Unable to start passkey setup');
      const registration = await startRegistration({ optionsJSON: optionsData.options });
      const suggestedName = /iPhone|iPad/.test(navigator.userAgent) ? 'Apple mobile passkey'
        : /Macintosh/.test(navigator.userAgent) ? 'Mac passkey'
          : /Windows/.test(navigator.userAgent) ? 'Windows passkey'
            : 'Passkey';
      const response = await fetch('/api/admin/passkeys/register/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: registration, state: optionsData.state, name: suggestedName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to add passkey');
      const refreshed = await fetch('/api/admin/passkeys', { credentials: 'include' }).then(result => result.json());
      setPasskeys(refreshed.passkeys ?? []);
      setPasskeyNotice({ type: 'ok', text: 'Passkey added. You can now use it instead of your password and authenticator code.' });
    } catch (error) {
      const message = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Passkey setup was cancelled.'
        : error instanceof Error ? error.message : 'Unable to add passkey';
      setPasskeyNotice({ type: 'error', text: message });
    } finally {
      setAddingPasskey(false);
    }
  }

  async function removePasskey(id: string) {
    const response = await fetch('/api/admin/passkeys', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (response.ok) setPasskeys(current => current.filter(item => item.id !== id));
  }

  async function patchAccount(body: Record<string, string>) {
    const response = await fetch('/api/admin/account', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Unable to save changes');
    return data;
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const data = await patchAccount({ action: 'profile', name, email });
      setAccount(data.account);
      setName(data.account.name);
      setEmail(data.account.email);
      setProfileNotice({ type: 'ok', text: 'Profile updated.' });
    } catch (error) {
      setProfileNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to update profile' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordNotice(null);
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'error', text: 'The new passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    try {
      await patchAccount({ action: 'password', currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice({ type: 'ok', text: 'Password changed.' });
    } catch (error) {
      setPasswordNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to change password' });
    } finally {
      setSavingPassword(false);
    }
  }

  async function beginTotpReset() {
    setResettingTotp(true);
    setTotpNotice(null);
    try {
      const data = await patchAccount({ action: 'beginTotpReset', currentPassword: totpPassword });
      setTotpSetup(data);
      setTotpCode('');
    } catch (error) {
      setTotpNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to reset 2FA' });
    } finally {
      setResettingTotp(false);
    }
  }

  async function confirmTotpReset() {
    if (!totpSetup) return;
    setResettingTotp(true);
    setTotpNotice(null);
    try {
      await patchAccount({
        action: 'confirmTotpReset',
        currentPassword: totpPassword,
        secret: totpSetup.secret,
        code: totpCode,
      });
      setTotpSetup(null);
      setTotpPassword('');
      setTotpCode('');
      setTotpNotice({ type: 'ok', text: 'Two-factor authentication has been reset.' });
    } catch (error) {
      setTotpNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to confirm 2FA' });
    } finally {
      setResettingTotp(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Account</h2>
          <p className="text-sm text-gray-500">Your details are shared across Admin and Finance.</p>
        </div>
        <form onSubmit={saveProfile} className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Name</span>
              <input value={name} onChange={event => setName(event.target.value)} className={inputClass} autoComplete="name" />
            </label>
            <label>
              <span className={labelClass}>Email</span>
              <input type="email" value={email} onChange={event => setEmail(event.target.value)} className={inputClass} autoComplete="email" />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400">
              {account ? `${account.role === 'owner' ? 'Owner' : 'Team member'} since ${new Date(account.createdAt).toLocaleDateString('en-GB')}` : 'Loading account…'}
            </p>
            <button type="submit" disabled={savingProfile || !name.trim() || !email.trim()} className={primaryButtonClass}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </div>
          <div className="mt-3"><NoticeBanner notice={profileNotice} /></div>
        </form>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Security</h2>
          <p className="text-sm text-gray-500">Update your password or connect a new authenticator.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={changePassword} className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Password</h3>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className={labelClass}>Current password</span>
                <input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className={inputClass} autoComplete="current-password" />
              </label>
              <label className="block">
                <span className={labelClass}>New password</span>
                <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className={inputClass} autoComplete="new-password" placeholder="At least 8 characters" />
              </label>
              <label className="block">
                <span className={labelClass}>Confirm new password</span>
                <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className={inputClass} autoComplete="new-password" />
              </label>
            </div>
            <div className="mt-4 space-y-3">
              <button type="submit" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword} className={primaryButtonClass}>
                {savingPassword ? 'Changing…' : 'Change password'}
              </button>
              <NoticeBanner notice={passwordNotice} />
            </div>
          </form>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">2FA Reset</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Replace the authenticator currently used to approve your login.
            </p>
            {!totpSetup ? (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className={labelClass}>Current password</span>
                  <input type="password" value={totpPassword} onChange={event => setTotpPassword(event.target.value)} className={inputClass} autoComplete="current-password" />
                </label>
                <button type="button" onClick={beginTotpReset} disabled={resettingTotp || !totpPassword} className={primaryButtonClass}>
                  {resettingTotp ? 'Preparing…' : 'Reset 2FA'}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={totpSetup.qrDataUrl} alt="New two-factor authentication QR code" className="h-36 w-36 rounded-lg border border-gray-100" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-5 text-gray-500">Scan this with your authenticator, then enter its six-digit code to confirm.</p>
                    <p className="mt-2 break-all rounded-md bg-gray-50 px-2 py-1.5 font-mono text-[10px] tracking-wider text-gray-500">{totpSetup.secret}</p>
                    <input value={totpCode} onChange={event => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className={`${inputClass} mt-3 max-w-36 text-center font-mono tracking-[0.3em]`} />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={confirmTotpReset} disabled={resettingTotp || totpCode.length !== 6} className={primaryButtonClass}>
                    {resettingTotp ? 'Confirming…' : 'Confirm new 2FA'}
                  </button>
                  <button type="button" onClick={() => { setTotpSetup(null); setTotpCode(''); }} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="mt-3"><NoticeBanner notice={totpNotice} /></div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Passkeys</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">Use Touch ID, Face ID, a device PIN, or a security key instead of your password and authenticator code.</p>
              </div>
              <button type="button" onClick={() => { void addPasskey(); }} disabled={addingPasskey} className={primaryButtonClass}>
                {addingPasskey ? 'Adding…' : 'Add passkey'}
              </button>
            </div>
            {passkeys.length > 0 && (
              <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
                {passkeys.map(passkey => (
                  <div key={passkey.id} className="flex items-center justify-between gap-4 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{passkey.name}</p>
                      <p className="text-xs text-gray-400">Added {new Date(passkey.createdAt).toLocaleDateString('en-GB')}{passkey.lastUsedAt ? ` · Last used ${new Date(passkey.lastUsedAt).toLocaleDateString('en-GB')}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => { if (confirm(`Remove ${passkey.name}?`)) void removePasskey(passkey.id); }} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3"><NoticeBanner notice={passkeyNotice} /></div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Login log</h2>
          <p className="text-sm text-gray-500">Recent successful and unsuccessful sign-in attempts for your account.</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {loadingLog ? (
            <p className="p-6 text-sm text-gray-400">Loading login history…</p>
          ) : loginEntries.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No login activity has been recorded yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {loginEntries.slice(0, 20).map(entry => {
                const successful = entry.outcome === 'success';
                return (
                  <div key={entry.id} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)_minmax(220px,1fr)_130px] sm:items-center">
                    <div>
                      <p className="font-medium text-gray-800">{new Date(entry.occurredAt).toLocaleDateString('en-GB')}</p>
                      <p className="text-xs text-gray-400">{new Date(entry.occurredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <p className="text-gray-600">{describeDevice(entry.userAgent)}</p>
                    <p className="min-w-0 break-all font-mono text-xs text-gray-400">{entry.ipAddress}{entry.country ? ` · ${entry.country}` : ''}</p>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium sm:justify-self-end ${
                      successful ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {successful ? 'Successful' : entry.outcome === 'failed_2fa' ? 'Incorrect 2FA' : 'Incorrect password'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
