'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/admin/ImageUpload';
import AudioUpload from '@/components/admin/AudioUpload';
import MarkdownEditor from '@/components/admin/MarkdownEditor';

function toSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function NewPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subheading, setSubheading] = useState('');
  const [author, setAuthor] = useState('Nathan Cooper');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [excerpt, setExcerpt] = useState('');
  const [image, setImage] = useState('');
  const [audio, setAudio] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) setSlug(toSlug(val));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title, subheading, date, excerpt, image, audio, author, content }),
    });
    if (res.ok) {
      router.push('/admin/writing');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setSaving(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">New post</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/writing')}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title || !slug}
            className="rounded-md bg-[#C4622D] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save post'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Metadata */}
        <div className="space-y-5 lg:col-span-1">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="Post title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Subheading (optional)</label>
                <input
                  type="text"
                  value={subheading}
                  onChange={e => setSubheading(e.target.value)}
                  placeholder="Shown just under the title on the post page"
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Author (optional)</label>
                <input
                  type="text"
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  placeholder="Shown next to the date"
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="url-friendly-slug"
                />
                <p className="mt-1 text-[11px] text-gray-400">This becomes the post URL and cannot be changed later.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Excerpt</label>
                <textarea
                  value={excerpt}
                  onChange={e => setExcerpt(e.target.value)}
                  rows={3}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
                  placeholder="Short summary shown on the blog listing page"
                />
              </div>

              <ImageUpload label="Cover image" value={image} onChange={setImage} meta={{ type: 'posts', name: title, date }} />

              <AudioUpload label="Audio reading (optional)" value={audio} onChange={setAudio} meta={{ type: 'posts', name: title, date }} />
            </div>
          </div>
        </div>

        {/* Content editor */}
        <div className="lg:col-span-2">
          <MarkdownEditor content={content} onChange={setContent} uploadMeta={{ type: 'posts', name: title, date }} />
        </div>
      </div>
    </div>
  );
}
