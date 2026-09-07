'use client';

import {
  useEffect, useState, useRef, useCallback,
  forwardRef, useImperativeHandle,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SocialPost, SocialPlatforms } from '@/types';
import { visiblePlatforms } from '@/lib/socialPlatforms';
import SocialLaunchBar from '@/components/admin/SocialLaunchBar';

const TYPE_LABELS: Record<string, string> = {
  photo: 'Photo', video: 'Video', carousel: 'Carousel',
};

// ─── Calendar ────────────────────────────────────────────────────────────────

type CalHandle = {
  activatePost: (postId: string, iso: string) => void;
  deactivate: () => void;
};

const AdminCalendar = forwardRef<CalHandle, { posts: SocialPost[] }>(
  function AdminCalendar({ posts }, ref) {
    const today   = new Date();
    const [year, setYear]   = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [pending, setPending]   = useState<{ id: string; iso: string } | null>(null);
    const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // After a month navigation the refs re-populate; resolve pending activation then.
    useEffect(() => {
      if (!pending) return;
      const btn = btnRefs.current.get(pending.id);
      if (btn) setActiveId(pending.id);
      setPending(null);
    }, [pending, year, month]);

    useEffect(() => () => { if (revertTimer.current) clearTimeout(revertTimer.current); }, []);

    useImperativeHandle(ref, () => ({
      activatePost(postId, iso) {
        if (revertTimer.current) { clearTimeout(revertTimer.current); revertTimer.current = null; }
        const d = new Date(iso);
        setYear(d.getFullYear());
        setMonth(d.getMonth());
        setPending({ id: postId, iso });
      },
      deactivate() {
        setActiveId(null);
        setPending(null);
        if (revertTimer.current) clearTimeout(revertTimer.current);
        // If the mouse isn't back over another card within a second, snap
        // the calendar back to the current month.
        revertTimer.current = setTimeout(() => {
          const now = new Date();
          setYear(now.getFullYear());
          setMonth(now.getMonth());
          revertTimer.current = null;
        }, 1000);
      },
    }), []);

    function prev() {
      if (month === 0) { setMonth(11); setYear(y => y - 1); }
      else setMonth(m => m - 1);
    }
    function next() {
      if (month === 11) { setMonth(0); setYear(y => y + 1); }
      else setMonth(m => m + 1);
    }

    // Group posts by day number for the current month
    const byDay: Record<number, SocialPost[]> = {};
    posts.forEach(p => {
      if (!p.date) return;
      const d = new Date(p.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        (byDay[day] ??= []).push(p);
      }
    });

    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset     = (firstDay + 6) % 7; // Mon-start

    const cells: (number | null)[] = [
      ...Array(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length < 42) cells.push(null);

    const monthName = new Date(year, month).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    return (
      <div className="flex flex-col">
        {/* Month nav */}
        <div className="mb-5 flex items-center justify-between">
          <button onClick={prev} className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">{monthName}</p>
          <button onClick={next} className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-hidden rounded-xl border border-gray-200">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
              <p key={d} className="border-r border-gray-100 py-2 text-center text-[9px] font-semibold uppercase tracking-widest text-gray-300 last:border-r-0">{d}</p>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const isLastRow = i >= cells.length - 7;
              const isLastCol = (i + 1) % 7 === 0;
              const border    = `${!isLastRow ? 'border-b' : ''} ${!isLastCol ? 'border-r' : ''} border-gray-100`;

              if (!day) return <div key={i} className={`aspect-square bg-gray-50/60 ${border}`} />;

              const dayPosts  = byDay[day] ?? [];
              const hasPosts  = dayPosts.length > 0;
              const allDone   = hasPosts && dayPosts.every(p => visiblePlatforms(p.type).every(({ key }) => p.platforms[key]));
              const isToday   = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isActive  = hasPosts && dayPosts.some(p => p.id === activeId);

              return (
                <div
                  key={i}
                  ref={el => {
                    if (hasPosts) {
                      if (el) dayPosts.forEach(p => btnRefs.current.set(p.id, el as unknown as HTMLButtonElement));
                      else    dayPosts.forEach(p => btnRefs.current.delete(p.id));
                    }
                  }}
                  className={[
                    'relative flex aspect-square flex-col items-center justify-center transition-colors',
                    border,
                    hasPosts && !allDone  ? 'bg-orange-200 hover:bg-orange-300' : '',
                    hasPosts && allDone   ? 'bg-green-200  hover:bg-green-300'  : '',
                    !hasPosts             ? 'hover:bg-gray-50'                   : '',
                    isActive && !allDone  ? '!bg-orange-300'                    : '',
                    isActive && allDone   ? '!bg-green-300'                     : '',
                  ].join(' ')}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                    isToday ? 'bg-gray-900 text-white' : 'text-gray-600'
                  }`}>
                    {day}
                  </span>
                  {hasPosts && (
                    <span className="mt-0.5 flex gap-0.5">
                      {dayPosts.slice(0, 3).map((_, j) => (
                        <span key={j} className={`h-1 w-1 rounded-full ${allDone ? 'bg-green-600' : 'bg-orange-600'}`} />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-orange-400" /> Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400" /> Fully posted
          </span>
        </div>
      </div>
    );
  },
);

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const router     = useRouter();
  const calRef     = useRef<CalHandle>(null);
  const [posts, setPosts]       = useState<SocialPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [hovered, setHovered]   = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<SocialPost | null>(null);

  useEffect(() => {
    fetch('/api/admin/social', { credentials: 'include' })
      .then(async r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(data => { setPosts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function togglePlatform(id: string, platform: keyof SocialPlatforms, current: boolean) {
    const updated = !current;
    setPosts(prev => prev.map(p =>
      p.id === id ? { ...p, platforms: { ...p.platforms, [platform]: updated } } : p
    ));
    const post = posts.find(p => p.id === id)!;
    await fetch(`/api/admin/social/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ platforms: { ...post.platforms, [platform]: updated } }),
    });
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/admin/social/${id}`, { method: 'DELETE', credentials: 'include' });
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  const fullyPosted = posts.filter(p => {
    const platforms = visiblePlatforms(p.type);
    return platforms.every(({ key }) => p.platforms[key]);
  }).length;

  return (
    <div className="flex items-start">

      {/* ── Left: post list (60%) ────────────────────────────── */}
      <div className="w-[60%] p-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Social</h1>
            {!loading && posts.length > 0 && (
              <p className="mt-1 text-sm text-gray-400">
                {fullyPosted} of {posts.length} fully cross-posted
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/social/frame-capture"
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Frame capture
            </Link>
            <Link href="/admin/social/new"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
              + Add content
            </Link>
          </div>
        </div>

        <SocialLaunchBar />

        {loading && <p className="text-sm text-gray-400">Loading…</p>}

        {!loading && posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-400">No content tracked yet.</p>
            <Link href="/admin/social/new" className="mt-3 inline-block text-sm font-medium text-gray-700 hover:text-gray-900">
              Add your first piece →
            </Link>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              <div className="w-10 shrink-0" />
              <span className="flex-1">Content</span>
              <span className="w-16 shrink-0">Type</span>
              <span className="w-44 shrink-0">Platforms</span>
              <span className="w-14 shrink-0" />
            </div>

            {posts.map(post => {
              const platforms = visiblePlatforms(post.type);
              const allDone   = platforms.every(({ key }) => post.platforms[key]);

              return (
                <div
                  key={post.id}
                  className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm transition-colors ${
                    allDone ? 'border-green-100' : 'border-gray-100'
                  }`}
                  onMouseEnter={() => post.date && calRef.current?.activatePost(post.id, post.date)}
                  onMouseLeave={() => calRef.current?.deactivate()}
                >
                  {/* Thumbnail */}
                  {(() => {
                    const isVideo = (u?: string | null) => !!u && /\.(mp4|mov|webm|mkv|avi)$/i.test(u);
                    const thumb = post.thumbnailUrl
                      ?? post.slides?.[0]?.thumbnailUrl
                      ?? (!isVideo(post.slides?.[0]?.url) ? post.slides?.[0]?.url : null)
                      ?? (!isVideo(post.fileUrl) ? post.fileUrl : null);
                    if (!thumb) return (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      </div>
                    );
                    return (
                      <button type="button" onClick={() => setLightbox(post)}
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 focus:outline-none"
                        title="View full size"
                      >
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                        {post.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><polygon points="2,1 9,5 2,9" /></svg>
                          </div>
                        )}
                        {post.type === 'carousel' && post.slides && post.slides.length > 1 && (
                          <div className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[8px] font-bold text-white leading-tight">
                            {post.slides.length}
                          </div>
                        )}
                      </button>
                    );
                  })()}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{post.title}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Type */}
                  <span className="w-16 shrink-0 text-xs font-medium text-gray-400">
                    {TYPE_LABELS[post.type] ?? post.type}
                  </span>

                  {/* Platform circles */}
                  <div className="flex w-44 shrink-0 items-center gap-1.5">
                    {platforms.map(({ key, short, label, doneBg, doneColor, hoverBg }) => {
                      const done    = post.platforms[key];
                      const btnKey  = `${post.id}-${key}`;
                      const isHov   = hovered === btnKey;
                      const bg      = done ? doneBg : isHov ? hoverBg : undefined;
                      const color   = done ? doneColor : isHov ? '#111' : undefined;
                      return (
                        <button
                          key={key}
                          title={`${label}: ${done ? 'posted' : 'not posted — click to toggle'}`}
                          onClick={() => togglePlatform(post.id, key, done)}
                          onMouseEnter={() => setHovered(btnKey)}
                          onMouseLeave={() => setHovered(null)}
                          style={{ backgroundColor: bg, color }}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-400 transition-all"
                        >
                          {done ? '✓' : short}
                        </button>
                      );
                    })}
                  </div>

                  {/* Edit / Delete */}
                  <div className="flex w-14 shrink-0 items-center justify-end gap-2">
                    <button onClick={() => router.push(`/admin/social/${post.id}`)}
                      className="text-xs text-gray-400 transition-colors hover:text-gray-700" title="Edit">
                      Edit
                    </button>
                    <button onClick={() => deletePost(post.id)}
                      className="text-lg leading-none text-gray-300 transition-colors hover:text-red-400" title="Delete">
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: calendar (40%) ────────────────────────────── */}
      <div className="sticky top-0 flex h-screen w-[40%] flex-col justify-center border-l border-gray-100 bg-gray-50/50 px-8 py-10 self-start">
        <AdminCalendar ref={calRef} posts={posts} />
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}>
          <div className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3" onClick={e => e.stopPropagation()}>

            {/* Top-right controls */}
            <div className="absolute -right-3 -top-3 flex items-center gap-1.5">
              <a
                href={lightbox.fileUrl}
                download={lightbox.fileUrl?.split('/').pop()}
                title="Download"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-700 shadow-md hover:bg-gray-100"
                onClick={e => e.stopPropagation()}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>
              <button onClick={() => setLightbox(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-700 shadow-md hover:bg-gray-100">
                ×
              </button>
            </div>

            {/* Main view */}
            {lightbox.type === 'video' && lightbox.fileUrl
              ? <video src={lightbox.fileUrl} controls autoPlay className="max-h-[75vh] max-w-[85vw] rounded-xl" />
              : <img src={lightbox.thumbnailUrl ?? lightbox.slides?.[0]?.thumbnailUrl ?? lightbox.slides?.[0]?.url ?? lightbox.fileUrl}
                  alt={lightbox.title} className="max-h-[75vh] max-w-[85vw] rounded-xl object-contain" />
            }

            {/* Carousel strip + download all */}
            {lightbox.type === 'carousel' && lightbox.slides && lightbox.slides.length > 1 && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {lightbox.slides.map((s, i) => (
                    <div key={i} className="group relative">
                      <img src={s.thumbnailUrl ?? s.url} alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={() => setLightbox({ ...lightbox, thumbnailUrl: s.thumbnailUrl ?? s.url, fileUrl: s.url })}
                      />
                      <a href={s.url} download={s.url.split('/').pop()}
                        onClick={e => e.stopPropagation()}
                        className="absolute -right-1 -top-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow"
                        title="Download slide"
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    lightbox.slides!.forEach((s, i) => {
                      setTimeout(() => {
                        const a = document.createElement('a');
                        a.href = s.url;
                        a.download = s.url.split('/').pop() ?? `slide-${i + 1}`;
                        a.click();
                      }, i * 400);
                    });
                  }}
                  className="text-xs text-white/50 hover:text-white/80 transition-colors"
                >
                  Download all {lightbox.slides.length} slides
                </button>
              </div>
            )}

            <p className="text-center text-sm text-white/70">{lightbox.title}</p>
          </div>
        </div>
      )}
    </div>
  );
}
