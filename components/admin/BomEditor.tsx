'use client';

import { useState } from 'react';
import RawMaterialPicker from '@/components/admin/RawMaterialPicker';

interface RawMaterial { name: string; item_code: string; item_name: string; brand: string | null }
interface BomLine { item_code: string; qty: string }
export interface BomSuggestion { lines: { item_code: string; qty: number; matched: boolean }[]; sourceLabel: string }

export default function BomEditor({
  itemCode, initialLines, rawMaterials, suggestion, onSaved, onCancel,
}: {
  itemCode: string;
  initialLines: { item_code: string; qty: number }[];
  rawMaterials: RawMaterial[];
  suggestion?: BomSuggestion | null;
  onSaved: (bomName: string) => void;
  onCancel?: () => void;
}) {
  const [lines, setLines] = useState<BomLine[]>(
    initialLines.length > 0
      ? initialLines.map(l => ({ item_code: l.item_code, qty: String(l.qty) }))
      : [{ item_code: '', qty: '1' }, { item_code: '', qty: '1' }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [pickingLine, setPickingLine] = useState<number | null>(null);

  function updateLine(i: number, patch: Partial<BomLine>) {
    setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  }
  function addLine() { setLines(prev => [...prev, { item_code: '', qty: '1' }]); }
  function removeLine(i: number) { setLines(prev => prev.filter((_, j) => j !== i)); }

  async function save() {
    const valid = lines.filter(l => l.item_code && parseFloat(l.qty) > 0);
    if (valid.length === 0) { setError('Add at least one raw material.'); return; }
    setSaving(true);
    setError(null);
    const r = await fetch('/api/admin/boms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ item_code: itemCode, items: valid.map(l => ({ item_code: l.item_code, qty: parseFloat(l.qty) })) }),
    });
    const data = await r.json();
    if (!r.ok) { setError(data.error ?? 'Failed to save BOM.'); setSaving(false); return; }
    setSaving(false);
    onSaved(data.name);
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
      {suggestion && initialLines.length === 0 && !suggestionApplied && (
        <div className="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <span>
            Copy from {suggestion.sourceLabel}?
            {suggestion.lines.some(l => !l.matched) && ' (some materials need picking manually)'}
          </span>
          <button
            onClick={() => {
              setLines(suggestion.lines.map(l => ({ item_code: l.matched ? l.item_code : '', qty: String(l.qty) })));
              setSuggestionApplied(true);
            }}
            className="font-medium underline underline-offset-2 hover:text-blue-900"
          >
            Apply
          </button>
        </div>
      )}
      {lines.map((line, i) => {
        const selected = rawMaterials.find(m => m.name === line.item_code);
        return (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => setPickingLine(i)}
              className="flex-1 truncate rounded-md border border-gray-200 bg-white px-2 py-1.5 text-left text-xs text-gray-700 hover:border-gray-400"
            >
              {selected ? selected.item_name : <span className="text-gray-400">Raw material…</span>}
            </button>
            <input
              type="number" min="0" step="1" value={line.qty}
              onChange={e => updateLine(i, { qty: e.target.value })}
              className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-right text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
            />
            <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-gray-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        );
      })}
      <button onClick={addLine} className="text-xs font-medium text-gray-500 hover:text-gray-800">+ Add material</button>
      {pickingLine !== null && (
        <RawMaterialPicker
          rawMaterials={rawMaterials}
          onClose={() => setPickingLine(null)}
          onPick={item => { updateLine(pickingLine, { item_code: item.name }); setPickingLine(null); }}
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40">
          {saving ? 'Saving…' : 'Save BOM'}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">Cancel</button>
        )}
      </div>
    </div>
  );
}
