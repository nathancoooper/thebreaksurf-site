'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { SocialContentType, SocialPlatforms, SocialPost, SocialSlide } from '@/types';
import { visiblePlatforms, platformsForType } from '@/lib/socialPlatforms';

const CONTENT_TYPES: { value: SocialContentType; label: string }[] = [
  { value: 'photo',    label: 'Photo'    },
  { value: 'video',    label: 'Video'    },
  { value: 'carousel', label: 'Carousel' },
];

const BLANK_PLATFORMS: SocialPlatforms = { instagram: false, tiktok: false, youtube: false, x: false, mastodon: false, pinterest: false };

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

// A slide that's already been saved (existing post)
type SavedSlide = SocialSlide & { _new?: false };

// A slide the user just added (not yet uploaded)
interface NewSlide {
  _new: true;
  file: File;
  preview: string;
  thumbDataUrl: string | null;
  isVideo: boolean;
}

type SlideEntry = SavedSlide | NewSlide;

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditSocialPost() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle]         = useState('');
  const [caption, setCaption]     = useState('');
  const [type, setType]           = useState<SocialContentType>('photo');
  const [date, setDate]           = useState('');
  const [notes, setNotes]         = useState('');
  const [platforms, setPlatforms] = useState<SocialPlatforms>({ ...BLANK_PLATFORMS });

  // Single-file state
  const [existingFileUrl, setExistingFileUrl]           = useState<string | undefined>();
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | undefined>();
  const [thumbCacheBust, setThumbCacheBust]             = useState(0);
  const [file, setFile]                 = useState<File | null>(null);
  const [preview, setPreview]           = useState<string | null>(null);
  const [isVideo, setIsVideo]           = useState(false);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);

  // Manual thumbnail (overrides auto-captured and existing)
  const [manualThumbFile, setManualThumbFile]       = useState<File | null>(null);
  const [manualThumbPreview, setManualThumbPreview] = useState<string | null>(null);

  // Carousel state — mix of saved and new slides
  const [slides, setSlides] = useState<SlideEntry[]>([]);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus]     = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // ── Load existing post ────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/admin/social`, { credentials: 'include' })
      .then(r => r.json())
      .then((posts: SocialPost[]) => {
        const post = posts.find(p => p.id === id);
        if (!post) { setNotFound(true); setLoading(false); return; }
        setTitle(post.title);
        setCaption(post.caption);
        setType(post.type);
        setDate(post.date);
        setNotes(post.notes);
        setPlatforms({ ...BLANK_PLATFORMS, ...post.platforms });
        setExistingFileUrl(post.fileUrl);
        setExistingThumbnailUrl(post.thumbnailUrl);
        if (post.type === 'carousel' && post.slides?.length) {
          setSlides(post.slides.map(s => ({ ...s, _new: false as const })));
        } else {
          if (post.thumbnailUrl) setPreview(post.thumbnailUrl);
          else if (post.fileUrl) setPreview(post.fileUrl);
        }
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

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
    if (newType === 'carousel') { setFile(null); setPreview(null); setThumbDataUrl(null); setManualThumbFile(null); setManualThumbPreview(null); }
    else { setSlides([]); }
  }

  // ── Single file ───────────────────────────────────────────────────────────

  async function handleFile(f: File | null) {
    setFile(f);
    setError(null);
    setThumbDataUrl(null);
    if (!f) {
      setIsVideo(false);
      setPreview(existingThumbnailUrl ?? existingFileUrl ?? null);
      return;
    }
    const vid = f.type.startsWith('video/');
    setIsVideo(vid);
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
    const newItems: NewSlide[] = [];
    for (const f of Array.from(files)) {
      const vid = f.type.startsWith('video/');
      let slidePreview = '';
      let thumb: string | null = null;
      if (vid) {
        try { const t = await captureVideoThumbnail(f); slidePreview = t; thumb = t; }
        catch { slidePreview = URL.createObjectURL(f); }
      } else {
        slidePreview = URL.createObjectURL(f);
      }
      newItems.push({ _new: true, file: f, preview: slidePreview, thumbDataUrl: thumb, isVideo: vid });
    }
    setSlides(prev => [...prev, ...newItems]);
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

  // ── Regenerate thumbnail from the already-uploaded video ─────────────────

  async function regenerateThumbnail() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/social/${id}/thumbnail`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed: ${res.status}`);
      const bust = Date.now();
      setExistingThumbnailUrl(data.thumbnailUrl);
      setThumbCacheBust(bust);
      setManualThumbFile(null);
      setManualThumbPreview(null);
      setThumbDataUrl(null);
      if (!file) setPreview(`${data.thumbnailUrl}?t=${bust}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regenerate failed');
    } finally {
      setRegenerating(false);
    }
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
      let fileUrl    = existingFileUrl;
      let thumbnailUrl = existingThumbnailUrl;
      let savedSlides: SocialSlide[] | undefined;

      if (type === 'carousel') {
        const uploaded: SocialSlide[] = [];
        for (let i = 0; i < slides.length; i++) {
          const s = slides[i];
          if (!s._new) {
            // Existing saved slide — keep as-is
            uploaded.push({ url: (s as SavedSlide).url, thumbnailUrl: (s as SavedSlide).thumbnailUrl });
          } else {
            const ns = s as NewSlide;
            setUploadStatus(`Uploading slide ${i + 1} of ${slides.length}…`);
            setUploadProgress(0);
            const result = await uploadWithProgress(ns.file, setUploadProgress);
            let thumbUrl = result.thumbnailPath;
            if (!thumbUrl && ns.thumbDataUrl) {
              const blob = await fetch(ns.thumbDataUrl).then(r => r.blob());
              const tf   = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
              thumbUrl   = (await uploadWithProgress(tf, () => {})).path;
            }
            uploaded.push({ url: result.path, thumbnailUrl: thumbUrl });
          }
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
        if (!manualThumbFile) {
          if (result.thumbnailPath) {
            thumbnailUrl = result.thumbnailPath;
          } else if (thumbDataUrl) {
            const blob = await fetch(thumbDataUrl).then(r => r.blob());
            const tf   = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
            thumbnailUrl = (await uploadWithProgress(tf, () => {})).path;
          }
        }
        setUploadProgress(null);
      }

      // Upload manual thumbnail regardless of whether the video file changed
      if (manualThumbFile) {
        thumbnailUrl = (await uploadWithProgress(manualThumbFile, () => {})).path;
      }

      const res = await fetch(`/api/admin/social/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
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

  if (loading)  return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (notFound) return <div className="p-8 text-sm text-gray-500">Post not found.</div>;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="mb-8 text-xl font-semibold text-gray-900">Edit post</h1>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label className={lbl}>Title</label>
          <input className={inp} value={title} onChange={e => setTitle(e.target.value)} required />
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
          <textarea className={`${inp} min-h-24 resize-y`} value={caption} onChange={e => setCaption(e.target.value)} />
        </div>

        {/* ── File upload ─────────────────────────────────────── */}
        <div>
          <label className={lbl}>{type === 'carousel' ? `Slides${slides.length ? ` (${slides.length})` : ''}` : 'File'}</label>

          {type === 'carousel' ? (
            <div className="space-y-3">
              {slides.length > 0 && (
                <div className="space-y-2">
                  {slides.map((s, i) => {
                    const imgSrc   = s._new ? (s as NewSlide).preview : ((s as SavedSlide).thumbnailUrl ?? (s as SavedSlide).url);
                    const isVid    = s._new ? (s as NewSlide).isVideo : false;
                    const name     = s._new ? (s as NewSlide).file.name : (s as SavedSlide).url.split('/').pop() ?? '';
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          <img src={imgSrc} alt="" className="h-full w-full object-cover" />
                          {isVid && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="white"><polygon points="2,1 9,5 2,9" /></svg>
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{name}</span>
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
                    );
                  })}
                </div>
              )}

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 text-center text-sm text-gray-400 hover:border-gray-400 transition-colors">
                <svg className="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                {slides.length > 0 ? 'Add more slides' : 'Add slides'}
                <input type="file" multiple className="hidden" accept="image/*,video/*"
                  onChange={e => e.target.files?.length && addSlides(e.target.files)} />
              </label>

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
              <label className="cursor-pointer text-xs text-gray-400 underline hover:text-gray-600">
                Replace file
                <input type="file" className="hidden" accept="image/*,video/*" onChange={e => handleFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          ) : (
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
              const rawPreview  = manualThumbPreview ?? thumbDataUrl ?? existingThumbnailUrl ?? null;
              const thumbPreview = rawPreview && rawPreview === existingThumbnailUrl && thumbCacheBust
                ? `${rawPreview}?t=${thumbCacheBust}` : rawPreview;
              if (thumbPreview) return (
                <div className="flex items-center gap-4">
                  <div className="relative inline-block">
                    <img src={thumbPreview} alt="Thumbnail" className="h-20 w-20 rounded-xl object-cover bg-gray-100" />
                    <button type="button"
                      onClick={() => { setManualThumbFile(null); setManualThumbPreview(null); setThumbDataUrl(null); setExistingThumbnailUrl(undefined); }}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] text-white">×</button>
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
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
                    {existingFileUrl && (
                      <button type="button" disabled={regenerating} onClick={regenerateThumbnail}
                        className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50">
                        {regenerating ? 'Regenerating…' : 'Regenerate from video'}
                      </button>
                    )}
                  </div>
                </div>
              );
              return (
                <div className="flex items-center gap-4">
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
                  {existingFileUrl && (
                    <button type="button" disabled={regenerating} onClick={regenerateThumbnail}
                      className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50">
                      {regenerating ? 'Regenerating…' : 'Regenerate from video'}
                    </button>
                  )}
                </div>
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
          <textarea className={`${inp} min-h-16 resize-y`} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={() => router.push('/admin/social')}
            className="rounded-md border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-400">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
