'use client';

import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';

interface SupplierItem {
  item_code: string;
  item_name: string;
  aliases: string[];
}

interface Supplier {
  name: string;
  vat_inclusive?: boolean;
  items: SupplierItem[];
}

interface ERPNextItem {
  name: string;
  item_code: string;
  item_name: string;
}

export default function SuppliersSettings() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [erpItems, setErpItems] = useState<ERPNextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/supplier-aliases', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/purchase-orders/options', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([aliasData, poData]) => {
        setSuppliers(aliasData.suppliers ?? []);
        setErpItems(poData.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(updated: Supplier[]) {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch('/api/admin/supplier-aliases', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suppliers: updated }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSuppliers(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function addSupplier() {
    const name = newSupplierName.trim().toUpperCase();
    if (!name || suppliers.some(s => s.name === name)) return;
    const updated = [...suppliers, { name, items: [] }];
    setNewSupplierName('');
    save(updated);
  }

  function removeSupplier(name: string) {
    if (!confirm(`Remove ${name}?`)) return;
    save(suppliers.filter(s => s.name !== name));
  }

  function addItem(supplierName: string, item: ERPNextItem) {
    const updated = suppliers.map(s => {
      if (s.name !== supplierName) return s;
      if (s.items.some(i => i.item_code === item.item_code)) return s;
      return { ...s, items: [...s.items, { item_code: item.item_code, item_name: item.item_name, aliases: [] }] };
    });
    setAddingItemFor(null);
    setItemSearch('');
    save(updated);
  }

  function removeItem(supplierName: string, itemCode: string) {
    const updated = suppliers.map(s => {
      if (s.name !== supplierName) return s;
      return { ...s, items: s.items.filter(i => i.item_code !== itemCode) };
    });
    save(updated);
  }

  function addAlias(supplierName: string, itemCode: string, alias: string) {
    const trimmed = alias.trim();
    if (!trimmed) return;
    const updated = suppliers.map(s => {
      if (s.name !== supplierName) return s;
      return {
        ...s,
        items: s.items.map(i => {
          if (i.item_code !== itemCode) return i;
          if (i.aliases.includes(trimmed)) return i;
          return { ...i, aliases: [...i.aliases, trimmed] };
        }),
      };
    });
    save(updated);
  }

  function removeAlias(supplierName: string, itemCode: string, alias: string) {
    const updated = suppliers.map(s => {
      if (s.name !== supplierName) return s;
      return {
        ...s,
        items: s.items.map(i => {
          if (i.item_code !== itemCode) return i;
          return { ...i, aliases: i.aliases.filter(a => a !== alias) };
        }),
      };
    });
    save(updated);
  }

  const filteredItems = erpItems.filter(item =>
    item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.item_code.toLowerCase().includes(itemSearch.toLowerCase())
  );

  if (loading) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Suppliers</h2>
        <p className="text-sm text-gray-500">Define PO suppliers and map their item names to ERPNext items.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="divide-y divide-gray-100">
          {suppliers.map(supplier => (
            <div key={supplier.name}>
              <button
                onClick={() => setExpandedSupplier(current => current === supplier.name ? null : supplier.name)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
                  <p className="text-xs text-gray-400">{supplier.items.length} item{supplier.items.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeSupplier(supplier.name); }}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Remove supplier"
                >
                  <FontAwesomeIcon icon={faTrash} className="w-3" />
                </button>
                <FontAwesomeIcon icon={faChevronDown} className={`w-3 shrink-0 text-gray-400 transition-transform ${expandedSupplier === supplier.name ? 'rotate-180' : ''}`} />
              </button>

              {expandedSupplier === supplier.name && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <label className="mb-3 flex items-start gap-2.5 rounded-lg border border-gray-200 bg-white p-3">
                    <input
                      type="checkbox"
                      checked={supplier.vat_inclusive !== false}
                      onChange={e => save(suppliers.map(s =>
                        s.name === supplier.name ? { ...s, vat_inclusive: e.target.checked } : s,
                      ))}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-gray-900"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-800">Line prices include VAT</span>
                      <span className="block text-xs text-gray-400">When PO autofill runs, lines are converted to net and the receipt's VAT is added as a charge, so totals reconcile to the amount paid.</span>
                    </span>
                  </label>

                  <div className="space-y-3">
                    {supplier.items.map(item => (
                      <div key={item.item_code} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                            <p className="text-xs text-gray-400">{item.item_code}</p>
                          </div>
                          <button
                            onClick={() => removeItem(supplier.name, item.item_code)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Remove item"
                          >
                            <FontAwesomeIcon icon={faTrash} className="w-3" />
                          </button>
                        </div>

                        <div className="mt-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Aliases</p>
                          <div className="flex flex-wrap gap-1">
                            {item.aliases.map(alias => (
                              <span key={alias} className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                                {alias}
                                <button
                                  onClick={() => removeAlias(supplier.name, item.item_code, alias)}
                                  className="text-gray-400 hover:text-red-600"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            <AddAliasInput onAdd={alias => addAlias(supplier.name, item.item_code, alias)} />
                          </div>
                        </div>
                      </div>
                    ))}

                    {addingItemFor === supplier.name ? (
                      <div className="rounded-lg border border-gray-200 bg-white p-3">
                        <input
                          type="text"
                          value={itemSearch}
                          onChange={e => setItemSearch(e.target.value)}
                          placeholder="Search ERPNext items..."
                          className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-gray-400"
                          autoFocus
                        />
                        <div className="mt-2 max-h-40 overflow-auto">
                          {filteredItems.slice(0, 20).map(item => (
                            <button
                              key={item.name}
                              onClick={() => addItem(supplier.name, item)}
                              className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                            >
                              <p className="font-medium text-gray-900">{item.item_name}</p>
                              <p className="text-xs text-gray-400">{item.item_code}</p>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => { setAddingItemFor(null); setItemSearch(''); }}
                          className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingItemFor(supplier.name)}
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
                      >
                        <FontAwesomeIcon icon={faPlus} className="w-3" />
                        Add item
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSupplier()}
              placeholder="New supplier name..."
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
            <button
              onClick={addSupplier}
              disabled={!newSupplierName.trim()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        {(error || saved) && (
          <div className="border-t border-gray-100 px-4 py-2">
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs text-green-700">Saved</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function AddAliasInput({ onAdd }: { onAdd: (alias: string) => void }) {
  const [value, setValue] = useState('');

  function handleSubmit() {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue('');
    }
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      onBlur={handleSubmit}
      placeholder="+ alias"
      className="w-20 rounded border border-gray-200 px-1.5 py-0.5 text-xs outline-none focus:border-gray-400"
    />
  );
}
