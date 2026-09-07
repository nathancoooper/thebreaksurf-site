'use client';

import { useEffect, useMemo, useState } from 'react';

export interface SalesProduct {
  name: string;
  item_code: string;
  item_name: string;
  stock_uom: string;
  brand: string | null;
  variant_of?: string | null;
  item_group?: string;
}

interface Family {
  name: string;
  items: SalesProduct[];
}

interface CategoryData {
  categories: string[];
  families: Record<string, string>;
}

function familyOf(itemName: string): string {
  const parts = itemName.split('-');
  if (parts.length <= 2) return parts[0].trim();
  return parts.slice(0, -2).join('-').trim();
}

function variantLabel(itemName: string, family: string): string {
  const rest = itemName.slice(family.length).replace(/^-/, '').trim();
  return rest || itemName;
}

export default function SalesProductPicker({
  items,
  onClose,
  onPick,
  onItemCreated,
}: {
  items: SalesProduct[];
  onClose: () => void;
  onPick: (item: SalesProduct) => void;
  onItemCreated: (item: SalesProduct) => void;
}) {
  const [localItems, setLocalItems] = useState(items);
  const [activeFamily, setActiveFamily] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryData>({ categories: [], families: {} });
  const [images, setImages] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [variantTemplate, setVariantTemplate] = useState<{ code: string; name: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/item-categories', { credentials: 'include' }).then(response => response.ok ? response.json() : null),
      fetch('/api/admin/item-images', { credentials: 'include' }).then(response => response.ok ? response.json() : null),
    ]).then(([categoryData, imageData]) => {
      if (categoryData) setCategories(categoryData);
      if (imageData) setImages(imageData);
    }).catch(() => {});
  }, []);

  const families = useMemo(() => {
    const map = new Map<string, SalesProduct[]>();
    for (const item of localItems) {
      const family = familyOf(item.item_name);
      if (!map.has(family)) map.set(family, []);
      map.get(family)!.push(item);
    }
    return Array.from(map.entries())
      .map(([name, familyItems]) => ({ name, items: familyItems.sort((a, b) => a.item_name.localeCompare(b.item_name)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [localItems]);

  const groups = useMemo(() => {
    const other = 'Other';
    const map = new Map<string, Family[]>();
    for (const family of families) {
      const category = categories.families[family.name]
        || (family.items[0]?.item_group === 'Services' ? 'Services' : other);
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push(family);
    }
    const ordered = [
      ...categories.categories.filter(category => map.has(category)),
      ...Array.from(map.keys()).filter(category => category !== other && !categories.categories.includes(category)).sort(),
      ...(map.has(other) ? [other] : []),
    ];
    return ordered.map(category => ({ category, families: map.get(category)! }));
  }, [categories, families]);

  const activeItems = activeFamily ? families.find(family => family.name === activeFamily)?.items ?? [] : [];
  const activeTemplate = activeItems.find(item => item.variant_of)?.variant_of ?? null;

  function addCreatedItem(item: SalesProduct) {
    setLocalItems(previous => [...previous, item]);
    onItemCreated(item);
    onPick(item);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-6" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            {activeFamily && (
              <button
                onClick={() => setActiveFamily(null)}
                className="flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
                Products
              </button>
            )}
            <h2 className="text-sm font-semibold text-gray-900">{activeFamily ?? 'Choose a product'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close product picker">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {!activeFamily ? (
            <div className="space-y-8">
              {groups.map(group => (
                <div key={group.category}>
                  <p className="px-3 pb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">{group.category}</p>
                  <div className="space-y-1">
                    {group.families.map(family => {
                      const thumbnail = images[`family:${family.name}`];
                      return (
                        <button
                          key={family.name}
                          onClick={() => setActiveFamily(family.name)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          {thumbnail ? (
                            <img src={thumbnail} alt="" className="h-9 w-9 shrink-0 rounded-md border border-gray-100 bg-gray-50 object-cover" />
                          ) : (
                            <div className="h-9 w-9 shrink-0 rounded-md border border-gray-100 bg-gray-50" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{family.name}</span>
                            {family.items[0]?.brand && <span className="block truncate text-xs text-gray-400">{family.items[0].brand}</span>}
                          </span>
                          <span className="text-xs text-gray-400">
                            {family.items.length} variant{family.items.length !== 1 ? 's' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-left text-sm text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Create new product or service
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {activeItems.map(item => {
                const thumbnail = images[`item:${item.item_code}`] ?? images[`family:${activeFamily}`];
                return (
                  <button
                    key={item.item_code}
                    onClick={() => onPick(item)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                  >
                    {thumbnail ? (
                      <img src={thumbnail} alt="" className="h-8 w-8 shrink-0 rounded-md border border-gray-100 bg-gray-50 object-cover" />
                    ) : (
                      <div className="h-8 w-8 shrink-0 rounded-md border border-gray-100 bg-gray-50" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-700">{variantLabel(item.item_name, activeFamily)}</span>
                      <span className="block truncate text-xs text-gray-400">{item.item_code}</span>
                    </span>
                  </button>
                );
              })}
              {activeTemplate && (
                <button
                  onClick={() => setVariantTemplate({ code: activeTemplate, name: activeFamily })}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-left text-sm text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Create new variant
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateProductModal
          onClose={() => setShowCreate(false)}
          onCreated={result => {
            setShowCreate(false);
            if (result.item) {
              addCreatedItem(result.item);
            } else {
              setVariantTemplate({ code: result.templateCode, name: result.templateName });
            }
          }}
        />
      )}
      {variantTemplate && (
        <CreateVariantModal
          template={variantTemplate}
          onClose={() => setVariantTemplate(null)}
          onCreated={item => {
            setVariantTemplate(null);
            addCreatedItem(item);
          }}
        />
      )}
    </div>
  );
}

function CreateProductModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (result: { templateCode: string; templateName: string; item?: SalesProduct }) => void;
}) {
  const [options, setOptions] = useState<{ brands: string[]; attributes: string[]; itemGroups: string[] }>({ brands: [], attributes: [], itemGroups: ['Products'] });
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemGroup, setItemGroup] = useState<'Products' | 'Services'>('Products');
  const [brand, setBrand] = useState('');
  const [trackStock, setTrackStock] = useState(true);
  const [hasVariants, setHasVariants] = useState(false);
  const [attributes, setAttributes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/items/options', { credentials: 'include' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(setOptions)
      .catch(() => {});
  }, []);

  async function submit() {
    if (!itemCode.trim() || !itemName.trim()) {
      setError('Item code and name are required.');
      return;
    }
    if (hasVariants && attributes.length === 0) {
      setError('Choose at least one variation attribute.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          item_code: itemCode.trim(),
          item_name: itemName.trim(),
          item_group: itemGroup,
          stock_uom: 'Nos',
          maintain_stock: itemGroup === 'Services' ? false : trackStock,
          allow_sales: true,
          allow_purchases: false,
          has_variants: itemGroup === 'Products' && hasVariants,
          attributes: itemGroup === 'Products' ? attributes : [],
          brand: brand || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'ERPNext could not create the product.');
      onCreated({
        templateCode: data.item_code,
        templateName: data.item_name,
        item: hasVariants ? undefined : {
          name: data.name,
          item_code: data.item_code,
          item_name: data.item_name,
          stock_uom: data.stock_uom ?? 'Nos',
          brand: brand || null,
          item_group: itemGroup,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ERPNext could not create the product.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900">Create new product or service</h3>
        <div className="mt-4 space-y-3">
          <Field label="Item type">
            <select
              value={itemGroup}
              onChange={event => {
                const next = event.target.value as 'Products' | 'Services';
                setItemGroup(next);
                if (next === 'Services') {
                  setTrackStock(false);
                  setHasVariants(false);
                  setAttributes([]);
                }
              }}
              className={inputClass}
            >
              <option value="Products">Product</option>
              <option value="Services">Service</option>
            </select>
          </Field>
          <Field label="Item code"><input value={itemCode} onChange={event => setItemCode(event.target.value)} className={inputClass} /></Field>
          <Field label={itemGroup === 'Services' ? 'Service name' : 'Product name'}><input value={itemName} onChange={event => setItemName(event.target.value)} className={inputClass} /></Field>
          <Field label="Brand">
            <select value={brand} onChange={event => setBrand(event.target.value)} className={inputClass}>
              <option value="">None</option>
              {options.brands.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={trackStock}
              onChange={event => setTrackStock(event.target.checked)}
              disabled={itemGroup === 'Services'}
              className="mt-0.5"
            />
            <span>
              <span className="block">Track stock</span>
              <span className="block text-xs text-gray-400">Untick for services such as artwork or digitisation.</span>
            </span>
          </label>
          {itemGroup === 'Products' && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={hasVariants} onChange={event => setHasVariants(event.target.checked)} />
              Has variations (colour, size, etc.)
            </label>
          )}
          {itemGroup === 'Products' && hasVariants && (
            <div className="flex flex-wrap gap-2 rounded-lg border border-gray-100 p-3">
              {options.attributes.map(attribute => (
                <button
                  key={attribute}
                  onClick={() => setAttributes(previous => previous.includes(attribute) ? previous.filter(value => value !== attribute) : [...previous, attribute])}
                  className={`rounded-full border px-3 py-1 text-xs ${attributes.includes(attribute) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                >
                  {attribute}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40">
            {saving ? 'Creating…' : `Create ${itemGroup === 'Services' ? 'service' : 'product'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateVariantModal({
  template,
  onClose,
  onCreated,
}: {
  template: { code: string; name: string };
  onClose: () => void;
  onCreated: (item: SalesProduct) => void;
}) {
  const [attributeOptions, setAttributeOptions] = useState<{ attribute: string; values: string[] }[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/items/${encodeURIComponent(template.code)}/variants`, { credentials: 'include' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setAttributeOptions(data.attributes ?? []))
      .catch(() => setAttributeOptions([]));
  }, [template.code]);

  async function submit() {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/items/${encodeURIComponent(template.code)}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ values }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'ERPNext could not create the variant.');
      onCreated({
        name: data.name,
        item_code: data.item_code,
        item_name: data.item_name,
        stock_uom: data.stock_uom ?? 'Nos',
        brand: null,
        variant_of: template.code,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ERPNext could not create the variant.');
    } finally {
      setSaving(false);
    }
  }

  const ready = Boolean(attributeOptions?.length) && attributeOptions!.every(option => values[option.attribute]?.trim());

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900">New variant of {template.name}</h3>
        {attributeOptions === null ? (
          <p className="mt-4 text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="mt-4 space-y-3">
            {attributeOptions.map(option => (
              <Field key={option.attribute} label={option.attribute}>
                <input
                  list={`sales-attribute-${option.attribute}`}
                  value={values[option.attribute] ?? ''}
                  onChange={event => setValues(previous => ({ ...previous, [option.attribute]: event.target.value }))}
                  className={inputClass}
                />
                <datalist id={`sales-attribute-${option.attribute}`}>
                  {option.values.map(value => <option key={value} value={value} />)}
                </datalist>
              </Field>
            ))}
          </div>
        )}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={!ready || saving} className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40">
            {saving ? 'Creating…' : 'Create variant'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      {children}
    </label>
  );
}
