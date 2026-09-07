'use client';

import { useState } from 'react';
import StarInput from '@/components/StarInput';

export default function ReviewForm({ productId, color }: { productId: string; color?: string }) {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setState('submitting');
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, name, rating, body }),
    });
    setState(res.ok ? 'done' : 'error');
  }

  if (state === 'done') {
    return (
      <div className="rounded-sm border border-charcoal/10 bg-sage/10 px-6 py-5">
        <p className="text-sm font-medium text-charcoal">Thanks, {name}!</p>
        <p className="mt-1 text-sm text-charcoal/60">Your review has been submitted and will appear once approved.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-charcoal/60">Your name</label>
        <input
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Jamie"
          className="mt-1.5 block w-full rounded-sm border border-charcoal/20 bg-transparent px-3 py-2 text-sm text-charcoal placeholder:text-charcoal/30 focus:border-charcoal/50 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-charcoal/60">Rating</label>
        <div className="mt-2">
          <StarInput value={rating} onChange={setRating} color={color} />
        </div>
        {!rating && state === 'error' && (
          <p className="mt-1 text-xs text-terra">Please select a rating</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-charcoal/60">Review</label>
        <textarea
          required
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={4}
          placeholder="What did you think?"
          className="mt-1.5 block w-full rounded-sm border border-charcoal/20 bg-transparent px-3 py-2 text-sm text-charcoal placeholder:text-charcoal/30 focus:border-charcoal/50 focus:outline-none"
        />
      </div>

      {state === 'error' && (
        <p className="text-sm text-terra">Something went wrong — please try again.</p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting' || !rating}
        className="rounded-sm px-6 py-2.5 text-sm font-medium text-cream transition disabled:opacity-50"
        style={{ background: color ?? '#C4622D' }}
      >
        {state === 'submitting' ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}
