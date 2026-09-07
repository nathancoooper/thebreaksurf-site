'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/admin/ImageUpload';

type ColorImageData = { cover: string; gallery: string[] };

function emptyColorData(): ColorImageData {
  return { cover: '', gallery: ['', '', '', ''] };
}

function toId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idEdited, setIdEdited] = useState(false);
  const [priceStr, setPriceStr] = useState('');
  const [description, setDescription] = useState('');
  const [detailsStr, setDetailsStr] = useState('');
  const [category, setCategory] = useState('Tops');
  const [sizesStr, setSizesStr] = useState('S, M, L, XL');
  const [colorsStr, setColorsStr] = useState('');
  const [featured, setFeatured] = useState(false);
  const [stripePriceId, setStripePriceId] = useState('');
  const [erpItemPrefix, setErpItemPrefix] = useState('');
  const [cover, setCover] = useState('');
  const [gallery, setGallery] = useState(['', '', '', '']);
  const [colorImages, setColorImages] = useState<Record<string, ColorImageData>>({});
  const [expandedColor, setExpandedColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeColors = colorsStr.split(',').map(s => s.trim()).filter(Boolean);

  function handleNameChange(val: string) {
    setName(val);
    if (!idEdited) setId(toId(val));
  }

  function setGalleryItem(i: number, val: string) {
    setGallery(g => g.map((v, idx) => idx === i ? val : v));
  }

  function setColorCover(color: string, val: string) {
    setColorImages(prev => ({
      ...prev,
      [color]: { ...prev[color] ?? emptyColorData(), cover: val },
    }));
  }

  function setColorGalleryItem(color: string, i: number, val: string) {
    setColorImages(prev => {
      const existing = prev[color] ?? emptyColorData();
      const g = [...existing.gallery];
      while (g.length < 4) g.push('');
      g[i] = val;
      return { ...prev, [color]: { ...existing, gallery: g } };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    const price = Math.round(parseFloat(priceStr) * 100);
    if (isNaN(price)) { setError('Enter a valid price'); setSaving(false); return; }

    const colorsOut: Record<string, ColorImageData> = {};
    for (const color of activeColors) {
      const data = colorImages[color];
      if (data && (data.cover || data.gallery.some(Boolean))) {
        colorsOut[color] = { cover: data.cover, gallery: data.gallery };
      }
    }

    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name,
        price,
        description,
        details: detailsStr.split('\n').map(s => s.trim()).filter(Boolean),
        category,
        sizes: sizesStr.split(',').map(s => s.trim()).filter(Boolean),
        colors: activeColors,
        featured,
        stripePriceId: stripePriceId || undefined,
        erpItemPrefix: erpItemPrefix || undefined,
        images: {
          cover,
          gallery,
          colors: colorsOut,
        },
      }),
    });

    if (res.ok) {
      router.push('/admin/products');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setSaving(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">New product</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/products')} className="text-sm text-gray-500 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name || !id}
            className="rounded-md bg-[#C4622D] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left — details */}
        <div className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input type="text" value={name} onChange={e => handleNameChange(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="Product name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ID / slug</label>
                <input type="text" value={id} onChange={e => { setId(e.target.value); setIdEdited(true); }}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="product-id" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price (£)</label>
                <input type="number" value={priceStr} onChange={e => setPriceStr(e.target.value)} min="0" step="0.01"
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="20.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="Product description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Details</label>
                <textarea value={detailsStr} onChange={e => setDetailsStr(e.target.value)} rows={4}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="One detail per line" />
                <p className="mt-1 text-[11px] text-gray-400">One bullet point per line</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sizes</label>
                <input type="text" value={sizesStr} onChange={e => setSizesStr(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="S, M, L, XL" />
                <p className="mt-1 text-[11px] text-gray-400">Comma-separated</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Colours</label>
                <input type="text" value={colorsStr} onChange={e => setColorsStr(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="Grass, Sky, Daffodil" />
                <p className="mt-1 text-[11px] text-gray-400">Comma-separated — colour sections appear below once entered</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Stripe Price ID</label>
                <input type="text" value={stripePriceId} onChange={e => setStripePriceId(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="price_... (optional)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ERPNext item name</label>
                <input type="text" value={erpItemPrefix} onChange={e => setErpItemPrefix(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="e.g. Staple Tee (optional)" />
                <p className="mt-1 text-[11px] text-gray-400">
                  Combined with colour/size to check live stock — e.g. &ldquo;Staple Tee&rdquo; + Grass + S looks up
                  &ldquo;Staple Tee-Grass-S&rdquo; in ERPNext. Leave blank to skip stock checks for this product.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)}
                  className="rounded border-gray-300 text-[#C4622D]" />
                Featured on homepage
              </label>
            </div>
          </div>
        </div>

        {/* Right — images */}
        <div className="space-y-5">
          {/* Default images */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-1 text-sm font-semibold text-gray-700">Default images</h2>
            <p className="mb-4 text-[11px] text-gray-400">Shown when no colour-specific images are set</p>
            <div className="space-y-4">
              <ImageUpload label="Cover (shop listing)" value={cover} onChange={setCover} meta={{ type: 'products', name, view: 'cover' }} />
              {gallery.map((val, i) => (
                <ImageUpload key={i} label={`Gallery ${i + 1}`} value={val} onChange={v => setGalleryItem(i, v)} meta={{ type: 'products', name, view: `gallery-${i + 1}` }} />
              ))}
            </div>
          </div>

          {/* Per-colour images — appear once colours are entered */}
          {activeColors.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-gray-700">Images by colour</h2>
                <p className="mt-0.5 text-[11px] text-gray-400">Override images when a specific colour is selected</p>
              </div>
              <div className="divide-y divide-gray-100">
                {activeColors.map(color => {
                  const isOpen = expandedColor === color;
                  const data = colorImages[color] ?? emptyColorData();
                  const hasImages = data.cover || data.gallery.some(Boolean);
                  return (
                    <div key={color}>
                      <button
                        type="button"
                        onClick={() => setExpandedColor(isOpen ? null : color)}
                        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                          {color}
                          {hasImages && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                              images set
                            </span>
                          )}
                        </span>
                        <span className="text-gray-400">{isOpen ? '↑' : '↓'}</span>
                      </button>
                      {isOpen && (
                        <div className="space-y-4 px-5 pb-5 pt-1">
                          <ImageUpload
                            label="Cover (shop listing)"
                            value={data.cover}
                            onChange={v => setColorCover(color, v)}
                            meta={{ type: 'products', name, color, view: 'cover' }}
                          />
                          {data.gallery.map((val, i) => (
                            <ImageUpload
                              key={i}
                              label={`Gallery ${i + 1}`}
                              value={val}
                              onChange={v => setColorGalleryItem(color, i, v)}
                              meta={{ type: 'products', name, color, view: `gallery-${i + 1}` }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
