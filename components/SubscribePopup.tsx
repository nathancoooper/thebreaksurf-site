'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Homepage newsletter pop-up: consent-gated capture, shows the single-use 10%
// code on success (it is also emailed). Appears once — dismissal and
// subscription both persist in localStorage so it never nags the same browser.

const STORAGE_KEY = 'tbs-sub-popup';
const DELAY_MS = 8000;

type Status = 'idle' | 'loading' | 'done' | 'already' | 'error';

function hasSeenPopup(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(STORAGE_KEY, 'subscribed');
  } catch {}
}

export default function SubscribePopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState(''); // honeypot — humans never see this
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (hasSeenPopup()) return;
    const timer = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
    try {
      if (!hasSeenPopup()) localStorage.setItem(STORAGE_KEY, 'dismissed');
    } catch {}
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setError('');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent, company, source: 'homepage-popup' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      remember();
      if (data.code) {
        setCode(data.code);
        setStatus('done');
      } else {
        setStatus('already');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Join the newsletter"
    >
      <div
        className="relative w-full max-w-md rounded-lg bg-white p-8 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
          aria-label="Close"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {status === 'done' ? (
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-terra">You&apos;re in</p>
            <h2 className="mt-2 font-display text-2xl font-medium text-charcoal">
              Here&apos;s your 10% off
            </h2>
            <div className="mt-5 rounded-sm border border-dashed border-charcoal/25 bg-charcoal/5 px-4 py-4">
              <p className="font-mono text-2xl font-semibold tracking-widest text-charcoal">{code}</p>
            </div>
            <button
              onClick={copyCode}
              className="mt-3 text-xs text-charcoal/50 underline underline-offset-4 hover:text-terra"
            >
              {copied ? 'Copied!' : 'Copy code'}
            </button>
            <p className="mt-4 text-sm leading-relaxed text-charcoal/60">
              We&apos;ve also emailed it to you. Add this code and your email at
              checkout — it&apos;s single-use and tied to this address.
            </p>
            <Link
              href="/products"
              onClick={close}
              className="mt-6 inline-block rounded-sm bg-terra px-7 py-3 text-sm font-medium text-cream hover:bg-terra/90"
            >
              Start shopping
            </Link>
          </div>
        ) : status === 'already' ? (
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-terra">Already on the list</p>
            <h2 className="mt-2 font-display text-2xl font-medium text-charcoal">You&apos;re subscribed</h2>
            <p className="mt-3 text-sm leading-relaxed text-charcoal/60">
              We&apos;ve got you down already — check your inbox for your welcome
              code. If it has already been used, reply to any of our emails and
              we&apos;ll sort it.
            </p>
            <button
              onClick={close}
              className="mt-6 rounded-sm border border-charcoal/20 px-7 py-3 text-sm font-medium text-charcoal hover:border-charcoal"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl font-medium text-charcoal">
              10% OFF
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/60">
              Drop news, early access, and the occasional offer — plus a
              single-use 10% code to use on your first order.
            </p>

            {/* Honeypot: off-screen, aria-hidden, tab-skipped. Bots fill it. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
              <label>
                Company
                <input
                  type="text"
                  name="company"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-sm border border-charcoal/20 bg-transparent px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/30 focus:border-charcoal focus:outline-none"
              />

              <label className="flex items-start gap-2.5 text-xs leading-relaxed text-charcoal/60">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-terra"
                />
                <span>Yes, send me marketing emails (new drops and offers).</span>
              </label>

              {status === 'error' && <p className="text-xs text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full rounded-sm bg-terra py-3 text-sm font-medium text-cream transition-all hover:bg-terra/90 disabled:opacity-60"
              >
                {status === 'loading' ? 'Signing you up…' : 'Get my 10% code'}
              </button>
            </form>

            <p className="mt-4 text-[11px] leading-relaxed text-charcoal/40">
              Unsubscribe at any time. See our{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-charcoal/60">
                privacy policy
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
