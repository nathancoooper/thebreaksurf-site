'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';

type Step = 'loading' | 'setup-password' | 'setup-qr' | 'password' | 'totp';
type Surface = 'Admin' | 'Finance' | 'Email';

function surfaceFromPath(pathname: string): Surface | null {
  if (pathname.startsWith('/finance')) return 'Finance';
  if (pathname.startsWith('/email')) return 'Email';
  if (pathname.startsWith('/admin')) return 'Admin';
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [surface, setSurface] = useState<Surface>(() => surfaceFromPath(pathname) ?? 'Admin');
  const [signedInPath, setSignedInPath] = useState(() => {
    const pathSurface = surfaceFromPath(pathname);
    return pathSurface === 'Finance' ? '/finance' : pathSurface === 'Email' ? '/email' : '/admin';
  });
  const [step, setStep]         = useState<Step>('loading');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [code, setCode]         = useState('');
  const [qrDataUrl, setQrDataUrl]   = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [copied, setCopied]         = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  useEffect(() => {
    fetch('/api/admin/login').then(r => r.json()).then(d => {
      // Production subdomains use clean URLs such as /login. In that case
      // usePathname cannot reveal which internal route tree the proxy selected.
      const hostname = window.location.hostname.toLowerCase();
      const nextSurface = surfaceFromPath(pathname)
        ?? (hostname.startsWith('emails.') ? 'Email' : hostname.startsWith('finance.') ? 'Finance' : 'Admin');
      setSurface(nextSurface);
      setSignedInPath(
        hostname.startsWith('emails.') || hostname.startsWith('finance.') || hostname.startsWith('admin.')
          ? '/'
          : nextSurface === 'Finance' ? '/finance' : nextSurface === 'Email' ? '/email' : '/admin',
      );
      setStep(d.needsSetup ? 'setup-password' : 'password');
    });
  }, [pathname]);

  async function handleSetupPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true); setError('');
    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Setup failed'); setBusy(false); return; }
    setQrDataUrl(data.qrDataUrl);
    setTotpSecret(data.totpSecret ?? '');
    setStep('setup-qr');
    setBusy(false);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Incorrect email or password'); setBusy(false); return; }
    setStep('totp');
    setBusy(false);
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/admin/login/totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Incorrect code');
      setBusy(false);
      return;
    }
    router.push(signedInPath);
  }

  async function handlePasskey() {
    if (!window.PublicKeyCredential) { setError('Passkeys are not supported by this browser.'); return; }
    setBusy(true); setError('');
    try {
      const optionsResponse = await fetch('/api/admin/passkeys/authenticate/options', { method: 'POST' });
      const optionsData = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(optionsData.error ?? 'Unable to start passkey login');
      const authentication = await startAuthentication({ optionsJSON: optionsData.options });
      const response = await fetch('/api/admin/passkeys/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authentication, state: optionsData.state }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Passkey sign-in failed');
      router.push(signedInPath);
    } catch (error) {
      setError(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Passkey sign-in was cancelled.'
        : error instanceof Error ? error.message : 'Passkey sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {surface === 'Admin' && (
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">The Break Surf</p>
          )}
          <h1 className="mt-1 text-xl font-semibold text-gray-900">
            {step.startsWith('setup') ? 'Create account' : surface}
          </h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">

          {/* ── First-run: choose password ─────────────────── */}
          {step === 'setup-password' && (
            <form onSubmit={handleSetupPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  autoFocus required placeholder="Your name"
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="you@example.com"
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm password</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  required
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button type="submit" disabled={busy}
                className="w-full rounded-md bg-[#C4622D] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                {busy ? 'Creating…' : 'Continue'}
              </button>
            </form>
          )}

          {/* ── First-run: scan QR & verify TOTP ──────────── */}
          {step === 'setup-qr' && (
            <form onSubmit={handleTotp} className="space-y-4">
              <p className="text-xs text-gray-500">
                Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password…), then enter the 6-digit code to confirm.
              </p>
              {qrDataUrl && (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="2FA QR code" className="h-40 w-40" />
                  {totpSecret && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(totpSecret);
                        setCopied(true);
                        if (copyTimer.current) clearTimeout(copyTimer.current);
                        copyTimer.current = setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-xs text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      <span className="tracking-widest">{totpSecret}</span>
                      <span className="ml-1 shrink-0 text-gray-400">
                        {copied ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        )}
                      </span>
                    </button>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">6-digit code</label>
                <input
                  type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                  value={code} onChange={e => setCode(e.target.value)}
                  autoFocus required placeholder="000000"
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-widest shadow-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button type="submit" disabled={busy}
                className="w-full rounded-md bg-[#C4622D] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                {busy ? 'Verifying…' : 'Verify & sign in'}
              </button>
            </form>
          )}

          {/* ── Returning: enter password ──────────────────── */}
          {step === 'password' && (
            <form onSubmit={handlePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  autoFocus required placeholder="you@example.com"
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button type="submit" disabled={busy}
                className="w-full rounded-md bg-[#C4622D] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                {busy ? 'Signing in…' : 'Continue'}
              </button>
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-gray-100" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-300">or</span>
                <span className="h-px flex-1 bg-gray-100" />
              </div>
              <button type="button" onClick={() => { void handlePasskey(); }} disabled={busy}
                className="w-full rounded-md border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                Sign in with a passkey
              </button>
            </form>
          )}

          {/* ── Returning: enter TOTP ─────────────────────── */}
          {step === 'totp' && (
            <form onSubmit={handleTotp} className="space-y-4">
              <p className="text-xs text-gray-500">Enter the 6-digit code from your authenticator app.</p>
              <input
                type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                value={code} onChange={e => setCode(e.target.value)}
                autoFocus required placeholder="000000"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-widest shadow-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button type="submit" disabled={busy}
                className="w-full rounded-md bg-[#C4622D] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                {busy ? 'Verifying…' : 'Sign in'}
              </button>
              <button type="button" onClick={() => { setStep('password'); setCode(''); setError(''); }}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600">
                ← Back
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
