'use client';

import { useEffect, useState } from 'react';

export default function StockCheckToggle() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/admin/stock-settings')
      .then(r => r.json())
      .then(d => { setOn(d.stockCheckEnabled); setLoaded(true); });
  }, []);

  async function toggle() {
    setBusy(true);
    const res = await fetch('/api/admin/stock-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockCheckEnabled: !on }),
    });
    const data = await res.json();
    setOn(data.stockCheckEnabled);
    setBusy(false);
  }

  if (!loaded) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Stock checking</p>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {on ? 'Blocking sold-out sales' : 'Stock checks disabled'}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {on ? 'ERPNext-linked products can’t be bought once sold out' : 'All products purchasable regardless of ERPNext stock'}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          className={`relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60 ${on ? 'bg-amber-500' : 'bg-gray-200'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>
    </div>
  );
}
