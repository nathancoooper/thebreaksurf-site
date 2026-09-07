'use client';

import { useEffect, useState } from 'react';

interface ItemCategories {
  categories: string[];
  families: Record<string, string>;
}

interface RawItem { item_code: string; item_name: string }
interface FamilyGroup { name: string; variants: RawItem[] }

function itemFamily(itemName: string): string {
  const parts = itemName.split('-');
  if (parts.length <= 2) return parts[0].trim();
  return parts.slice(0, -2).join('-').trim();
}

function itemVariantLabel(itemName: string, family: string): string {
  const rest = itemName.slice(family.length).replace(/^-/, '').trim();
  return rest || itemName;
}

// Compact inline image upload — same /api/admin/upload endpoint and visual
// language as components/admin/ImageUpload, just small enough to sit inside
// a list row instead of a full form field.
function InlineImageUpload({ imageKey, value, onSaved }: { imageKey: string; value: string; onSaved: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function saveKey(url: string | null) {
    const r = await fetch('/api/admin/item-images', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: imageKey, imageUrl: url }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error ?? 'Could not save the image.');
    onSaved(url ?? '');
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'items');
    fd.append('name', imageKey);
    try {
      const response = await fetch('/api/admin/upload', { method: 'POST', credentials: 'include', body: fd });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.path) throw new Error(data.error ?? 'Could not upload the image.');
      await saveKey(data.path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload the image.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function clearImage() {
    setError('');
    try {
      await saveKey(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not clear the image.');
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="h-9 w-9 rounded-md border border-gray-200 object-cover bg-gray-50" />
        ) : (
          <div className="h-9 w-9 rounded-md border border-dashed border-gray-200 bg-gray-50" />
        )}
        <label className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-800">
          {uploading ? '…' : value ? 'Replace' : 'Upload'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {value && (
          <button onClick={clearImage} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
        )}
      </div>
      {error && <p className="mt-1 max-w-40 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

export default function ItemCategoriesPage() {
  const [data, setData] = useState<ItemCategories | null>(null);
  const [groups, setGroups] = useState<FamilyGroup[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingFamily, setSavingFamily] = useState<string | null>(null);
  const [addingCategoryFor, setAddingCategoryFor] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/item-categories', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/purchase-orders/options', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/admin/sales-orders/options', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/admin/item-images', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
    ])
      .then(([cats, purchaseOptions, salesOptions, imgs]) => {
        setData(cats);
        setImages(imgs);
        const selectableItems = [
          ...(purchaseOptions?.items ?? []),
          ...(salesOptions?.items ?? []),
        ] as RawItem[];
        if (selectableItems.length > 0) {
          const map = new Map<string, RawItem[]>();
          for (const it of selectableItems) {
            const fam = itemFamily(it.item_name);
            if (!map.has(fam)) map.set(fam, []);
            if (!map.get(fam)!.some(existing => existing.item_code === it.item_code)) {
              map.get(fam)!.push(it);
            }
          }
          const list = Array.from(map.entries())
            .map(([name, variants]) => ({ name, variants: variants.sort((a, b) => a.item_name.localeCompare(b.item_name)) }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setGroups(list);
        } else {
          setGroups(Object.keys(cats.families).sort((a, b) => a.localeCompare(b)).map(name => ({ name, variants: [] })));
        }
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    // The initial request owns the page loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function setCategory(family: string, category: string): Promise<boolean> {
    setSavingFamily(family);
    setSaveError('');
    try {
      const r = await fetch('/api/admin/item-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ family, category }),
      });
      const updated = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(updated.error ?? 'Could not save the category.');
      setData(updated);
      return true;
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Could not save the category.');
      return false;
    } finally {
      setSavingFamily(null);
    }
  }

  async function saveNewCategory(family: string) {
    const category = newCategoryName.trim();
    if (!category || !await setCategory(family, category)) return;
    setAddingCategoryFor(null);
    setNewCategoryName('');
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Item Categories</h1>
        <p className="text-sm text-gray-400">Group item families under shared Purchase Order and Invoice picker categories, and set their photos.</p>
      </div>

      {saveError && <p className="mb-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && data && (
        <div className="max-w-2xl overflow-hidden rounded-2xl border border-gray-100 bg-white">
          {groups.length === 0 && (
            <p className="p-8 text-center text-sm text-gray-400">No raw-material families found.</p>
          )}
          {groups.map(g => {
            const category = data.families[g.name] ?? '';
            const isAddingNew = addingCategoryFor === g.name;
            const isExpanded = expanded === g.name;
            const familyImageKey = `family:${g.name}`;
            return (
              <div key={g.name} className="border-b border-gray-100 last:border-b-0">
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <InlineImageUpload
                      imageKey={familyImageKey}
                      value={images[familyImageKey] ?? ''}
                      onSaved={url => setImages(prev => ({ ...prev, [familyImageKey]: url }))}
                    />
                    <button
                      onClick={() => setExpanded(isExpanded ? null : g.name)}
                      className="text-sm text-gray-700 hover:text-gray-900"
                    >
                      {g.name}
                      {g.variants.length > 1 && <span className="ml-2 text-xs text-gray-400">{g.variants.length} variants</span>}
                    </button>
                  </div>
                  {isAddingNew ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder="New category"
                        className="w-40 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-gray-400 focus:outline-none"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newCategoryName.trim()) {
                            void saveNewCategory(g.name);
                          }
                          if (e.key === 'Escape') { setAddingCategoryFor(null); setNewCategoryName(''); }
                        }}
                      />
                      <button
                        disabled={!newCategoryName.trim() || savingFamily === g.name}
                        onClick={() => void saveNewCategory(g.name)}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button onClick={() => { setAddingCategoryFor(null); setNewCategoryName(''); }} className="text-xs text-gray-400 hover:text-gray-600">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <select
                      value={category}
                      disabled={savingFamily === g.name}
                      onChange={e => {
                        if (e.target.value === '__new__') { setAddingCategoryFor(g.name); return; }
                        void setCategory(g.name, e.target.value);
                      }}
                      className="w-48 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-gray-400 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Uncategorised</option>
                      {data.categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__new__">+ New category…</option>
                    </select>
                  )}
                </div>

                {isExpanded && g.variants.length > 0 && (
                  <div className="space-y-1 border-t border-gray-100 bg-gray-50/50 px-5 py-3">
                    {g.variants.map(v => {
                      const variantKey = `item:${v.item_code}`;
                      return (
                        <div key={v.item_code} className="flex items-center gap-3 py-1">
                          <InlineImageUpload
                            imageKey={variantKey}
                            value={images[variantKey] ?? ''}
                            onSaved={url => setImages(prev => ({ ...prev, [variantKey]: url }))}
                          />
                          <span className="text-sm text-gray-600">{itemVariantLabel(v.item_name, g.name)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
