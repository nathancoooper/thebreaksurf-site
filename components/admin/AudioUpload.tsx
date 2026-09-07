'use client';

import { useEffect, useRef, useState } from 'react';

interface UploadMeta {
  type: string;
  name?: string;
  date?: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (path: string) => void;
  meta?: UploadMeta;
}

export default function AudioUpload({ label, value, onChange, meta }: Props) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProgress(0);
    setError('');

    const fd = new FormData();
    fd.append('file', file);
    if (meta) {
      fd.append('type', meta.type);
      if (meta.name) fd.append('name', meta.name);
      if (meta.date) fd.append('date', meta.date);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload');

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.path) {
          onChangeRef.current(data.path);
        } else {
          setError(data.error ?? `Server error ${xhr.status}`);
        }
      } catch {
        setError(`Unexpected response (${xhr.status}): ${xhr.responseText.slice(0, 100)}`);
      }
      setProgress(null);
      e.target.value = '';
    };

    xhr.onerror = () => { setProgress(null); setError('Network error'); };
    xhr.send(fd);
  }

  const uploading = progress !== null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1.5 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="/images/uploads/posts/..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#C4622D] focus:outline-none focus:ring-1 focus:ring-[#C4622D]"
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {uploading ? `${progress}%` : 'Upload'}
          <input
            type="file"
            className="hidden"
            accept="audio/*"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {value && (
        <audio controls src={value} className="mt-2 h-9 w-full max-w-sm" />
      )}
    </div>
  );
}
