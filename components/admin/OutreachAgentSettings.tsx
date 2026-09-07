'use client';

import { useEffect, useState } from 'react';

const NUMERIC_FIELDS: Array<{ key: string; label: string; min: number; max: number; suffix?: string }> = [
  { key: 'nudgeIntervalDays', label: 'Days between follow-ups', min: 1, max: 90 },
  { key: 'maxNudges', label: 'Max follow-ups', min: 0, max: 5 },
  { key: 'replyDelayMinHours', label: 'Min reply delay (hours)', min: 0, max: 72 },
  { key: 'replyDelayMaxHours', label: 'Max reply delay (hours)', min: 1, max: 168 },
  { key: 'revisitMonths', label: 'Revisit "maybe later" after (months)', min: 1, max: 24 },
  { key: 'dailySendCap', label: 'Daily send cap', min: 1, max: 100 },
];

export default function OutreachAgentSettings() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/agents/settings', { credentials: 'include' })
      .then(async r => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(data => setSettings(data.outreach ?? {}))
      .catch(() => setError('Failed to load outreach settings'))
      .finally(() => setLoading(false));
  }, []);

  function update(key: string, value: unknown) {
    setSettings(current => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch('/api/admin/agents/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreach: settings }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Failed to save outreach settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) return null;

  const field = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400';

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Outreach agent</h2>
        <p className="text-sm text-gray-500">Autonomous artist outreach — pitch, nudges, and replies from {String(settings.fromAddress ?? '')}.</p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Send from</span>
            <input type="text" value={String(settings.fromAddress ?? '')} onChange={e => update('fromAddress', e.target.value)} className={field} />
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Escalate to (quotes &amp; blocked questions)</span>
            <input type="text" value={String(settings.escalationAddress ?? '')} onChange={e => update('escalationAddress', e.target.value)} className={field} />
          </label>
        </div>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Opening email subject</span>
          <input type="text" value={String(settings.pitchSubject ?? '')} onChange={e => update('pitchSubject', e.target.value)} className={field} />
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Opening email body</span>
          <span className="mb-1 block text-xs text-gray-400">Use {'{{name}}'} where the artist&apos;s first name should go.</span>
          <textarea rows={6} value={String(settings.pitchBody ?? '')} onChange={e => update('pitchBody', e.target.value)} className={field} />
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">System prompt</span>
          <span className="mb-1 block text-xs text-gray-400">Persona and rules the agent follows in every conversation.</span>
          <textarea rows={10} value={String(settings.systemPrompt ?? '')} onChange={e => update('systemPrompt', e.target.value)} className={field} />
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Standing rules</span>
          <span className="mb-1 block text-xs text-gray-400">One rule per line. Applied to every email the agent writes, on top of the persona.</span>
          <textarea rows={6} value={String(settings.outreachRules ?? '')} onChange={e => update('outreachRules', e.target.value)} className={field} />
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Company information</span>
          <span className="mb-1 block text-xs text-gray-400">Facts about The Break Surf the agent may reference when answering artist questions.</span>
          <textarea rows={7} value={String(settings.companyInfo ?? '')} onChange={e => update('companyInfo', e.target.value)} className={field} />
        </label>

        <div>
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cadence &amp; limits</span>
          <div className="grid gap-4 sm:grid-cols-3">
            {NUMERIC_FIELDS.map(({ key, label, min, max }) => (
              <label key={key}>
                <span className="mb-1 block text-xs text-gray-500">{label}</span>
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={String(settings[key] ?? '')}
                  onChange={e => update(key, e.target.value === '' ? '' : Number(e.target.value))}
                  className={field}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs text-green-700">Saved</p>}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  );
}
