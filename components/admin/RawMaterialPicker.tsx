'use client';

import { useState } from 'react';

interface RawMaterial { name: string; item_code: string; item_name: string; brand: string | null }
interface Family { name: string; items: RawMaterial[] }

const OTHER_BRAND = 'Other';

// Raw material item names follow "Product Name-Colour-Size" (e.g. "FoTL
// Premium Tee-Mineral Blue-L") or have no variant suffix at all — same
// convention as itemFamily/itemVariantLabel in the PO item picker, just
// duplicated locally here since this picker groups by brand instead of
// category and isn't otherwise reused.
function familyOf(itemName: string): string {
  const parts = itemName.split('-');
  if (parts.length <= 2) return parts[0].trim();
  return parts.slice(0, -2).join('-').trim();
}
function variantLabel(itemName: string, family: string): string {
  const rest = itemName.slice(family.length).replace(/^-/, '').trim();
  return rest || itemName;
}

export default function RawMaterialPicker({
  rawMaterials, onPick, onClose, title = 'Choose raw material',
}: {
  rawMaterials: RawMaterial[];
  onPick: (item: RawMaterial) => void;
  onClose: () => void;
  title?: string;
}) {
  const [activeFamily, setActiveFamily] = useState<string | null>(null);

  const families: Family[] = (() => {
    const map = new Map<string, RawMaterial[]>();
    for (const it of rawMaterials) {
      const fam = familyOf(it.item_name);
      if (!map.has(fam)) map.set(fam, []);
      map.get(fam)!.push(it);
    }
    return Array.from(map.entries())
      .map(([name, its]) => ({ name, items: its.sort((a, b) => a.item_name.localeCompare(b.item_name)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const groups = (() => {
    const map = new Map<string, Family[]>();
    for (const f of families) {
      const brand = f.items[0]?.brand || OTHER_BRAND;
      if (!map.has(brand)) map.set(brand, []);
      map.get(brand)!.push(f);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a === OTHER_BRAND ? 1 : b === OTHER_BRAND ? -1 : a.localeCompare(b)))
      .map(([brand, fams]) => ({ brand, families: fams }));
  })();

  const activeItems = activeFamily ? families.find(f => f.name === activeFamily)?.items ?? [] : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-6" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">{activeFamily ?? title}</h3>
          <div className="flex items-center gap-3">
            {activeFamily && (
              <button onClick={() => setActiveFamily(null)} className="text-xs font-medium text-gray-500 hover:text-gray-800">
                Back
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {!activeFamily ? (
            groups.map(g => (
              <div key={g.brand} className="mb-3">
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{g.brand}</p>
                {g.families.map(f => (
                  <button
                    key={f.name}
                    onClick={() => setActiveFamily(f.name)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span>{f.name}</span>
                    <span className="text-xs text-gray-400">{f.items.length} variant{f.items.length !== 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            ))
          ) : (
            activeItems.map(it => (
              <button
                key={it.item_code}
                onClick={() => onPick(it)}
                className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                {variantLabel(it.item_name, activeFamily)}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
