'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SocialContentType, SocialPlatforms, SocialSlide } from '@/types';
import { visiblePlatforms, platformsForType } from '@/lib/socialPlatforms';

const CONTENT_TYPES: { value: SocialContentType; label: string }[] = [
  { value: 'photo',    label: 'Photo'    },
  { value: 'video',    label: 'Video'    },
  { value: 'carousel', label: 'Carousel' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function captureVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.random() * Math.min(video.duration * 0.2, 30);
    });
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    });
    video.addEventListener('error', () => { URL.revokeObjectURL(url); reject(new Error('Could not read video')); });
  });
}

interface UploadResult {
  path: string;
  thumbnailPath?: string; // server-generated still frame, videos only
}

function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd  = new FormData();
    fd.append('file', file);
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Upload response was not valid JSON')); }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.open('POST', '/api/admin/upload');
    xhr.withCredentials = true;
    xhr.send(fd);
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlideItem {
  file: File;
  preview: string;       // object URL or canvas data URL shown in the UI
  thumbDataUrl: string | null; // canvas capture for videos (uploaded separately)
  isVideo: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const BLANK_PLATFORMS: SocialPlatforms = { instagram: false, tiktok: false, youtube: false, x: false, mastodon: false, pinterest: false };

export default function NewSocialPost() {
  const router = useRouter();

  const [title, setTitle]         = useState('');
  const [caption, setCaption]     = useState('');
  const [type, setType]           = useState<SocialContentType>('photo');
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]         = useState('');
  const [platforms, setPlatforms] = useState<SocialPlatforms>({ ...BLANK_PLATFORMS });

  // Single-file state (photo / video)
  const [file, setFile]                 = useState<File | null>(null);
  const [preview, setPreview]           = useState<string | null>(null);
  const [isVideo, setIsVideo]           = useState(false);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);

  // Manual thumbnail (overrides auto-captured)
  const [manualThumbFile, setManualThumbFile]       = useState<File | null>(null);
  const [manualThumbPreview, setManualThumbPreview] = useState<string | null>(null);

  // Carousel state
  const [slides, setSlides] = useState<SlideItem[]>([]);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus]     = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Type change ───────────────────────────────────────────────────────────

  function handleType(newType: SocialContentType) {
    setType(newType);
    const available = platformsForType(newType);
    setPlatforms(prev => {
      const next = { ...prev };
      (Object.keys(next) as (keyof SocialPlatforms)[]).forEach(k => {
        if (!available.includes(k)) next[k] = false;
      });
      return next;
    });
    // Clear files when switching modes
    if (newType === 'carousel') { setFile(null); setPreview(null); setThumbDataUrl(null); setManualThumbFile(null); setManualThumbPreview(null); }
    else { setSlides([]); }
  }

  // ── Single file (photo / video) ───────────────────────────────────────────

  async function handleFile(f: File | null) {
    setFile(f);
    setError(null);
    setPreview(null);
    setThumbDataUrl(null);
    if (!f) { setIsVideo(false); setManualThumbFile(null); setManualThumbPreview(null); return; }
    const vid = f.type.startsWith('video/');
    setIsVideo(vid);
    // Auto-switch type
    handleType(vid ? 'video' : 'photo');
    if (vid) {
      try {
        const thumb = await captureVideoThumbnail(f);
        setPreview(thumb);
        setThumbDataUrl(thumb);
      } catch {
        setPreview(URL.createObjectURL(f));
      }
    } else {
      setPreview(URL.createObjectURL(f));
    }
  }

  // ── Carousel slides ───────────────────────────────────────────────────────

  async function addSlides(files: FileList) {
    const newItems: SlideItem[] = [];
    for (const f of Array.from(files)) {
      const vid = f.type.startsWith('video/');
      let slidePreview = '';
      let thumbDataUrl: string | null = null;
      if (vid) {
        try {
          const thumb = await captureVideoThumbnail(f);
          slidePreview = thumb;
          thumbDataUrl = thumb;
        } catch {
          slidePreview = URL.createObjectURL(f);
        }
      } else {
        slidePreview = URL.createObjectURL(f);
      }
      newItems.push({ file: f, preview: slidePreview, thumbDataUrl, isVideo: vid });
    }
    setSlides(prev => [...prev, ...newItems]);
    if (type !== 'carousel') handleType('carousel');
  }

  function removeSlide(i: number) {
    setSlides(prev => prev.filter((_, j) => j !== i));
  }

  function moveSlide(i: number, dir: -1 | 1) {
    setSlides(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // ── Platforms ─────────────────────────────────────────────────────────────

  function togglePlatform(key: keyof SocialPlatforms) {
    setPlatforms(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const activePlatforms = visiblePlatforms(type);
  const allChecked      = activePlatforms.every(p => platforms[p.key]);

  function toggleAll() {
    const next = !allChecked;
    setPlatforms(prev => {
      const updated = { ...prev };
      activePlatforms.forEach(({ key }) => { updated[key] = next; });
      return updated;
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    try {
      let fileUrl: string | undefined;
      let thumbnailUrl: string | undefined;
      let savedSlides: SocialSlide[] | undefined;

      if (type === 'carousel') {
        // Upload each slide in order
        const uploaded: SocialSlide[] = [];
        for (let i = 0; i < slides.length; i++) {
          setUploadStatus(`Uploading slide ${i + 1} of ${slides.length}…`);
          setUploadProgress(0);
          const result = await uploadWithProgress(slides[i].file, setUploadProgress);
          let thumbUrl = result.thumbnailPath;
          if (!thumbUrl && slides[i].thumbDataUrl) {
            const blob = await fetch(slides[i].thumbDataUrl!).then(r => r.blob());
            const tf   = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
            thumbUrl   = (await uploadWithProgress(tf, () => {})).path;
          }
          uploaded.push({ url: result.path, thumbnailUrl: thumbUrl });
        }
        savedSlides  = uploaded;
        fileUrl      = uploaded[0]?.url;
        thumbnailUrl = uploaded[0]?.thumbnailUrl ?? uploaded[0]?.url;
        setUploadStatus(null);
        setUploadProgress(null);

      } else if (file) {
        setUploadProgress(0);
        const result = await uploadWithProgress(file, setUploadProgress);
        fileUrl = result.path;
        if (manualThumbFile) {
          thumbnailUrl = (await uploadWithProgress(manualThumbFile, () => {})).path;
        } else if (result.thumbnailPath) {
          thumbnailUrl = result.thumbnailPath;
        } else if (thumbDataUrl) {
          const blob = await fetch(thumbDataUrl).then(r => r.blob());
          const tf   = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
          thumbnailUrl = (await uploadWithProgress(tf, () => {})).path;
        }
        setUploadProgress(null);
      }

      const res = await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: title.trim(), caption: caption.trim(), type, date,
          notes: notes.trim(), fileUrl, thumbnailUrl,
          slides: savedSlides,
          platforms,
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      router.push('/admin/social');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
      setUploadProgress(null);
      setUploadStatus(null);
    }
  }

  const lbl = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5';
  const inp = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none';

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="mb-8 text-xl font-semibold text-gray-900">Add content</h1>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label className={lbl}>Title</label>
          <input className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. March litter pick recap" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Content type</label>
            <select className={inp} value={type} onChange={e => handleType(e.target.value as SocialContentType)}>
              {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Date</label>
            <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={lbl}>Caption</label>
          <textarea className={`${inp} min-h-24 resize-y`} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write your caption…" />
        </div>

        {/* ── File upload ─────────────────────────────────────── */}
        <div>
          <label className={lbl}>{type === 'carousel' ? `Slides${slides.length ? ` (${slides.length})` : ''}` : 'File (optional)'}</label>

          {type === 'carousel' ? (
            <div className="space-y-3">
              {/* Slide list */}
              {slides.length > 0 && (
                <div className="space-y-2">
                  {slides.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <img src={s.preview} alt="" className="h-full w-full object-cover" />
                        {s.isVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="white"><polygon points="2,1 9,5 2,9" /></svg>
                          </div>
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{s.file.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => moveSlide(i, -1)} disabled={i === 0}
                          className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 6.5l3-3 3 3"/></svg>
                        </button>
                        <button type="button" onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1}
                          className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 3.5l3 3 3-3"/></svg>
                        </button>
                        <button type="button" onClick={() => removeSlide(i)}
                          className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-gray-100 hover:text-red-400">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add more / drop zone */}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 text-center text-sm text-gray-400 hover:border-gray-400 transition-colors">
                <svg className="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                {slides.length > 0 ? 'Add more slides' : 'Add slides (photos or videos)'}
                <input type="file" multiple className="hidden" accept="image/*,video/*"
                  onChange={e => e.target.files?.length && addSlides(e.target.files)} />
              </label>

              {/* Upload progress for carousel */}
              {uploadStatus && uploadProgress !== null && (
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{uploadStatus}</span><span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gray-900 transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>

          ) : preview ? (
            /* Single file preview */
            <div className="space-y-3">
              <div className="relative inline-block">
                <img src={preview} alt="" className="h-32 w-32 rounded-xl object-cover bg-gray-100" />
                {isVideo && (
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><polygon points="2,1 9,5 2,9" /></svg>
                    <span className="text-[9px] font-semibold text-white uppercase tracking-wide">Video</span>
                  </div>
                )}
                <button type="button" onClick={() => handleFile(null)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] text-white">×</button>
              </div>
              {uploadProgress !== null && uploadProgress < 100 && (
                <div className="w-48">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Uploading…</span><span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gray-900 transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Single file drop zone */
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-8 text-center hover:border-gray-400 transition-colors">
              <svg className="mb-2 h-6 w-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="text-sm text-gray-400">Click to upload photo or video</p>
              <p className="mt-1 text-xs text-gray-300">Up to 1 GB</p>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={e => handleFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>

        {/* ── Thumbnail (video only) ──────────────────────────── */}
        {type === 'video' && (
          <div>
            <label className={lbl}>Thumbnail</label>
            {(() => {
              const thumbPreview = manualThumbPreview ?? thumbDataUrl;
              if (thumbPreview) return (
                <div className="flex items-center gap-4">
                  <div className="relative inline-block">
                    <img src={thumbPreview} alt="Thumbnail" className="h-20 w-20 rounded-xl object-cover bg-gray-100" />
                    <button type="button"
                      onClick={() => { setManualThumbFile(null); setManualThumbPreview(null); setThumbDataUrl(null); }}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] text-white">×</button>
                  </div>
                  <label className="cursor-pointer text-xs text-gray-400 underline hover:text-gray-600">
                    Replace
                    <input type="file" className="hidden" accept="image/*"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setManualThumbFile(f);
                        setManualThumbPreview(URL.createObjectURL(f));
                      }} />
                  </label>
                </div>
              );
              return (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-gray-400 hover:border-gray-400 transition-colors">
                  <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload thumbnail image
                  <input type="file" className="hidden" accept="image/*"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setManualThumbFile(f);
                      setManualThumbPreview(URL.createObjectURL(f));
                    }} />
                </label>
              );
            })()}
          </div>
        )}

        {/* ── Platforms ───────────────────────────────────────── */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={lbl} style={{ marginBottom: 0 }}>Platforms</label>
            <button type="button" onClick={toggleAll} className="text-xs text-gray-400 hover:text-gray-600">
              {allChecked ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            {activePlatforms.map(({ key, label, link, doneBg, doneColor }, i) => {
              const checked = platforms[key];
              return (
                <div key={key}
                  className={`flex items-center gap-3 px-4 py-3 ${i < activePlatforms.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <button type="button" onClick={() => togglePlatform(key)}
                    style={checked ? { backgroundColor: doneBg, borderColor: doneBg } : undefined}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${checked ? '' : 'border-gray-300 hover:border-gray-400'}`}
                  >
                    {checked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className="flex-1 cursor-pointer select-none text-sm text-gray-700" onClick={() => togglePlatform(key)}>
                    {label}
                  </span>
                  <a href={link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                    Post
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 8.5l7-7M8.5 1.5H4M8.5 1.5v4.5" />
                    </svg>
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className={lbl}>Notes (optional)</label>
          <textarea className={`${inp} min-h-16 resize-y`} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Scheduling notes, Canva link, etc." />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="rounded-md border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-400">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
