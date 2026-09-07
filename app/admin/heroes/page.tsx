'use client';

import { useEffect, useRef, useState } from 'react';

interface Hero {
  id: string;
  title: string;
  label: string;
  heading: string;
  buttonText: string;
  buttonHref: string;
  image: string;
}

function HeroCard({ hero: initial }: { hero: Hero }) {
  const [hero, setHero] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    setSaving(true);
    const { id, image, title, ...fields } = hero;
    await fetch(`/api/admin/heroes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`/api/admin/heroes/${hero.id}`, { method: 'PUT', body: fd });
    const updated: Hero = await res.json();
    setHero(h => ({ ...h, image: updated.image }));
    setUploading(false);
  }

  function field(key: keyof Hero, label: string, hint?: string) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
        {hint && <p className="mb-1 text-[11px] text-gray-400">{hint}</p>}
        <input
          type="text"
          value={hero[key] as string}
          onChange={e => setHero(h => ({ ...h, [key]: e.target.value }))}
          className="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Image preview */}
      <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-gray-100">
        <img
          src={hero.image}
          alt={hero.title}
          className="h-full w-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/60">{hero.label}</p>
          <p className="font-serif text-xl font-medium text-white">{hero.heading}</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded bg-black/50 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Change image
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
        />
      </div>

      {/* Fields */}
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{hero.title}</h3>
        </div>
        {field('label', 'Label', 'Small uppercase text above the heading')}
        {field('heading', 'Heading', 'Main one-line hero text')}
        {field('buttonText', 'Button text')}
        {field('buttonHref', 'Button link')}
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

export default function HeroesPage() {
  const [heroes, setHeroes] = useState<Hero[]>([]);

  useEffect(() => {
    fetch('/api/admin/heroes').then(r => r.json()).then(setHeroes);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Hero Sections</h1>
      <p className="mb-8 text-sm text-gray-500">Edit the image and text for each page&apos;s hero banner. Changes go live immediately.</p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {heroes.map(hero => <HeroCard key={hero.id} hero={hero} />)}
      </div>
    </div>
  );
}
