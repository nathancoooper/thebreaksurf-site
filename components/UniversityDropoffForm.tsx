'use client';

import { useEffect, useState } from 'react';
import UniversityReceipt from './UniversityReceipt';

const PLACEMENTS = ['Left chest', 'Right chest', 'Centre chest', 'Back', 'Cap / beanie', 'Other'];
const COLOURS = ['White', 'Black', 'Navy', 'Grass green', 'Terracotta', 'Cream', 'Grey'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass = 'block w-full rounded-sm border border-charcoal/20 bg-transparent px-4 py-3 text-base text-charcoal placeholder:text-charcoal/30 focus:border-charcoal/50 focus:outline-none';
const optionClass = 'w-full rounded-sm border border-charcoal/15 px-4 py-3 text-left text-sm font-medium text-charcoal transition-colors hover:border-terra/50 hover:bg-terra/5';
const optionActiveClass = 'w-full rounded-sm border border-terra bg-terra/10 px-4 py-3 text-left text-sm font-medium text-terra';
const continueClass = 'rounded-sm bg-terra px-6 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-40';

type Values = {
  studentName: string;
  studentEmail: string;
  garment: string;
  placement: string;
  colour: string;
  note: string;
};

const STEP_COUNT = 8;

// Real cloud photo, pulled from the "We Left the Cloud for a Cupboard" post cover.
function CloudsReceiptPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-[480px] items-center justify-center overflow-hidden rounded-sm bg-cover bg-center lg:min-h-[720px]"
      style={{ backgroundImage: 'url(/images/university-clouds.webp)' }}
    >
      <div className="relative z-10 px-8">{children}</div>
    </div>
  );
}

export default function UniversityDropoffForm() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({
    studentName: '',
    studentEmail: '',
    garment: '',
    placement: '',
    colour: '',
    note: '',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [customColour, setCustomColour] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues(v => ({ ...v, [key]: value }));
  }

  function choosePhoto(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function next() {
    setError('');
    setStep(s => Math.min(s + 1, STEP_COUNT - 1));
  }

  function back() {
    setError('');
    setStep(s => Math.max(s - 1, 0));
  }

  async function submit() {
    setState('submitting');
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.append(key, value));
    if (photo) formData.append('photo', photo);
    const res = await fetch('/api/university-dropoff', { method: 'POST', body: formData });
    setState(res.ok ? 'done' : 'error');
  }

  if (state === 'done') {
    return (
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-stretch">
        <div className="rounded-md border border-charcoal/10 bg-sage/10 px-6 py-5">
          <p className="text-sm font-medium text-charcoal">Thanks, {values.studentName}!</p>
          <p className="mt-1 text-sm text-charcoal/60">
            We&rsquo;ve got your details. Drop the garment off at reception this week and we&rsquo;ll collect it Friday.
          </p>
        </div>
        <CloudsReceiptPanel>
          <UniversityReceipt values={values} step={STEP_COUNT - 1} hasPhoto={!!photo} />
        </CloudsReceiptPanel>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-stretch">
      <div className="rounded-md border border-charcoal/10 bg-white/60 p-8 shadow-sm">
        {/* Progress dots */}
        <div className="mb-8 flex gap-1.5">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-terra' : 'bg-charcoal/10'}`}
            />
          ))}
        </div>

        <div key={step} className="animate-step-in">
        {step === 0 && (
          <form onSubmit={e => { e.preventDefault(); if (values.studentName.trim()) next(); }}>
            <label className="block font-display text-xl font-medium text-charcoal">What&rsquo;s your name?</label>
            <input
              autoFocus
              type="text"
              required
              value={values.studentName}
              onChange={e => update('studentName', e.target.value)}
              placeholder="e.g. Jamie Smith"
              className={`${inputClass} mt-5`}
            />
            <div className="mt-6">
              <button type="submit" disabled={!values.studentName.trim()} className={continueClass}>Continue</button>
            </div>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={e => {
            e.preventDefault();
            if (!EMAIL_PATTERN.test(values.studentEmail)) { setError('Please enter a valid email address'); return; }
            next();
          }}>
            <label className="block font-display text-xl font-medium text-charcoal">What&rsquo;s your university email?</label>
            <input
              autoFocus
              type="email"
              required
              value={values.studentEmail}
              onChange={e => update('studentEmail', e.target.value)}
              placeholder="e.g. jamie.smith@uni.ac.uk"
              className={`${inputClass} mt-5`}
            />
            {error && <p className="mt-2 text-sm text-terra">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={back} className="text-sm font-medium text-charcoal/50 hover:text-charcoal">Back</button>
              <button type="submit" disabled={!values.studentEmail.trim()} className={continueClass}>Continue</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={e => { e.preventDefault(); if (values.garment.trim()) next(); }}>
            <label className="block font-display text-xl font-medium text-charcoal">What&rsquo;s the garment?</label>
            <input
              autoFocus
              type="text"
              required
              value={values.garment}
              onChange={e => update('garment', e.target.value)}
              placeholder="e.g. Black zip-up hoodie"
              className={`${inputClass} mt-5`}
            />
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={back} className="text-sm font-medium text-charcoal/50 hover:text-charcoal">Back</button>
              <button type="submit" disabled={!values.garment.trim()} className={continueClass}>Continue</button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div>
            <label className="block font-display text-xl font-medium text-charcoal">Where should the logo go?</label>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {PLACEMENTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { update('placement', p); next(); }}
                  className={values.placement === p ? optionActiveClass : optionClass}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-6">
              <button type="button" onClick={back} className="text-sm font-medium text-charcoal/50 hover:text-charcoal">Back</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <label className="block font-display text-xl font-medium text-charcoal">Got a photo of where you want it? <span className="text-base font-normal text-charcoal/40">(optional)</span></label>
            <p className="mt-2 text-sm text-charcoal/60">
              Handy if you picked &ldquo;Other&rdquo;, or just want to show us exactly where.
            </p>
            {photoPreview ? (
              <div className="mt-5 flex items-center gap-4">
                <img src={photoPreview} alt="Selected placement photo" className="h-20 w-20 rounded-sm object-cover" />
                <button type="button" onClick={() => choosePhoto(null)} className="text-sm font-medium text-charcoal/50 hover:text-charcoal">Remove</button>
              </div>
            ) : (
              <label className={`${optionClass} mt-5 block cursor-pointer text-center`}>
                Choose a photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => choosePhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={back} className="text-sm font-medium text-charcoal/50 hover:text-charcoal">Back</button>
              <button type="button" onClick={next} className={continueClass}>{photo ? 'Continue' : 'Skip'}</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <label className="block font-display text-xl font-medium text-charcoal">What thread colour?</label>
            {!customColour ? (
              <>
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  {COLOURS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { update('colour', c); next(); }}
                      className={values.colour === c ? optionActiveClass : optionClass}
                    >
                      {c}
                    </button>
                  ))}
                  <button type="button" onClick={() => setCustomColour(true)} className={optionClass}>Other…</button>
                </div>
                <div className="mt-6">
                  <button type="button" onClick={back} className="text-sm font-medium text-charcoal/50 hover:text-charcoal">Back</button>
                </div>
              </>
            ) : (
              <form onSubmit={e => { e.preventDefault(); if (values.colour.trim()) next(); }}>
                <input
                  autoFocus
                  type="text"
                  required
                  value={values.colour}
                  onChange={e => update('colour', e.target.value)}
                  placeholder="e.g. Burgundy"
                  className={`${inputClass} mt-5`}
                />
                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setCustomColour(false)} className="text-sm font-medium text-charcoal/50 hover:text-charcoal">Back</button>
                  <button type="submit" disabled={!values.colour.trim()} className={continueClass}>Continue</button>
                </div>
              </form>
            )}
          </div>
        )}

        {step === 6 && (
          <form onSubmit={e => { e.preventDefault(); next(); }}>
            <label className="block font-display text-xl font-medium text-charcoal">Anything else? <span className="text-base font-normal text-charcoal/40">(optional)</span></label>
            <textarea
              autoFocus
              value={values.note}
              onChange={e => update('note', e.target.value)}
              rows={3}
              placeholder="Any extra detail about placement, sizing, or the design"
              className={`${inputClass} mt-5`}
            />
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={back} className="text-sm font-medium text-charcoal/50 hover:text-charcoal">Back</button>
              <button type="submit" className={continueClass}>{values.note.trim() ? 'Continue' : 'Skip'}</button>
            </div>
          </form>
        )}

        {step === 7 && (
          <div>
            <label className="block font-display text-xl font-medium text-charcoal">Ready to submit?</label>
            <p className="mt-3 text-sm text-charcoal/60">
              Check the receipt alongside — if anything&rsquo;s wrong, hit back to fix it.
            </p>
            {state === 'error' && (
              <p className="mt-4 text-sm text-terra">Something went wrong — please try again.</p>
            )}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={back} className="text-sm font-medium text-charcoal/50 hover:text-charcoal">Back</button>
              <button type="button" onClick={submit} disabled={state === 'submitting'} className={continueClass}>
                {state === 'submitting' ? 'Submitting…' : 'Submit drop-off details'}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
      <CloudsReceiptPanel>
        <UniversityReceipt values={values} step={step} hasPhoto={!!photo} />
      </CloudsReceiptPanel>
    </div>
  );
}
