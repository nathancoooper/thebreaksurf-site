'use client';

import { useMemo, useState } from 'react';

export interface CustomerOption {
  name: string;
  customer_name: string;
}

export default function CustomerPicker({
  customers,
  onClose,
  onPick,
  onCreated,
}: {
  customers: CustomerOption[];
  onClose: () => void;
  onPick: (customer: CustomerOption) => void;
  onCreated: (customer: CustomerOption) => void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'Individual' | 'Company'>('Individual');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(customer =>
      customer.customer_name.toLowerCase().includes(needle) || customer.name.toLowerCase().includes(needle),
    );
  }, [customers, query]);

  async function createCustomer() {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customer_name: name.trim(), customer_type: type }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'ERPNext could not create the customer.');
      const customer = { name: data.name, customer_name: name.trim() };
      onCreated(customer);
      onPick(customer);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ERPNext could not create the customer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-6" onClick={onClose}>
      <div className="flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{creating ? 'Create new customer' : 'Choose a customer'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close customer picker">×</button>
        </div>

        {creating ? (
          <div className="p-6">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Customer name</span>
                <input autoFocus value={name} onChange={event => setName(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Customer type</span>
                <select value={type} onChange={event => setType(event.target.value as 'Individual' | 'Company')}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                  <option value="Individual">Individual</option>
                  <option value="Company">Company</option>
                </select>
              </label>
            </div>
            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
            <div className="mt-6 flex gap-2">
              <button onClick={() => { setCreating(false); setError(''); }} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50">Back</button>
              <button onClick={createCustomer} disabled={!name.trim() || saving}
                className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40">
                {saving ? 'Creating…' : 'Create customer'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-gray-100 p-3">
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search customers…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
              />
            </div>
            <div className="flex-1 overflow-auto p-3">
              <div className="space-y-1">
                {filtered.map(customer => (
                  <button
                    key={customer.name}
                    onClick={() => onPick(customer)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                      {customer.customer_name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-gray-700">{customer.customer_name}</span>
                      {customer.name !== customer.customer_name && <span className="block truncate text-xs text-gray-400">{customer.name}</span>}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-400">No customers found.</p>}
              </div>
            </div>
            <div className="border-t border-gray-100 p-3">
              <button
                onClick={() => { setCreating(true); setName(query); }}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-left text-sm text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
              >
                <span className="text-base leading-none">+</span>
                Create new customer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
