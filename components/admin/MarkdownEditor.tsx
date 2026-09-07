'use client';

import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkHighlight from '@/lib/remarkHighlight';

interface UploadMeta {
  type: string;
  name?: string;
  date?: string;
}

interface Props {
  content: string;
  onChange: (value: string) => void;
  uploadMeta?: UploadMeta;
}

export default function MarkdownEditor({ content, onChange, uploadMeta }: Props) {
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${content}\n\n${text}\n\n`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${content.slice(0, start)}\n\n${text}\n\n${content.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      const pos = start + text.length + 4;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', uploadMeta?.type ?? 'posts');
    if (uploadMeta?.name) fd.append('name', uploadMeta.name);
    if (uploadMeta?.date) fd.append('date', uploadMeta.date);

    fetch('/api/admin/upload', { method: 'POST', body: fd })
      .then(r => r.json())
      .then(data => {
        if (data.path) {
          insertAtCursor(`![](${data.path})`);
        } else {
          setError(data.error ?? 'Upload failed');
        }
      })
      .catch(() => setError('Network error'))
      .finally(() => {
        setUploading(false);
        e.target.value = '';
      });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-3">
        <h2 className="flex-1 text-sm font-semibold text-gray-700">Content</h2>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs font-medium text-gray-500 hover:text-gray-900 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : '+ Insert image'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFile}
        />
        <div className="flex rounded-md border border-gray-200 text-xs font-medium">
          <button
            type="button"
            onClick={() => setPreview(false)}
            className={`px-3 py-1.5 transition-colors ${!preview ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className={`px-3 py-1.5 transition-colors ${preview ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Preview
          </button>
        </div>
      </div>

      {error && <p className="border-b border-gray-100 px-5 py-2 text-xs text-red-600">{error}</p>}

      {preview ? (
        <div className="prose prose-sm min-h-[500px] max-w-none p-5">
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkHighlight]}
              remarkRehypeOptions={{
                handlers: {
                  highlightMark: (state: unknown, node: { children: unknown[] }) => ({
                    type: 'element',
                    tagName: 'mark',
                    properties: {},
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    children: (state as any).all(node),
                  }),
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any}
              components={{
                mark: ({ children }) => (
                  <mark className="rounded-sm bg-[#C4622D]/20 px-0.5">{children}</mark>
                ),
                img: ({ src, alt }) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} className="my-2 rounded-md" />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <p className="text-gray-400">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => onChange(e.target.value)}
          className="block h-[500px] w-full resize-none p-5 font-mono text-sm text-gray-800 focus:outline-none"
          placeholder="Write your post in Markdown… use ==text== to highlight."
        />
      )}
    </div>
  );
}
