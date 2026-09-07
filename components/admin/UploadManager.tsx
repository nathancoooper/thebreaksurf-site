'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface ActiveUpload {
  id: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  tag?: string; // optional identifier so callers can find their upload
}

interface UploadMeta {
  type: string;
  name?: string;
  date?: string;
  color?: string;
  view?: string;
}

interface UploadContextValue {
  uploads: ActiveUpload[];
  startUpload: (
    file: File,
    onComplete: (path: string) => Promise<void> | void,
    options?: { onError?: (err: string) => void; tag?: string; meta?: UploadMeta },
  ) => void;
}

const UploadContext = createContext<UploadContextValue>({
  uploads: [],
  startUpload: () => {},
});

export function useUpload() {
  return useContext(UploadContext);
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<ActiveUpload[]>([]);

  const startUpload = useCallback((
    file: File,
    onComplete: (path: string) => Promise<void> | void,
    options?: { onError?: (err: string) => void; tag?: string; meta?: UploadMeta },
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    setUploads(prev => [...prev, {
      id, tag: options?.tag,
      filename: file.name,
      progress: 0,
      status: 'uploading',
    }]);

    const formData = new FormData();
    formData.append('file', file);
    if (options?.meta) {
      const m = options.meta;
      formData.append('type', m.type);
      if (m.name) formData.append('name', m.name);
      if (m.date) formData.append('date', m.date);
      if (m.color) formData.append('color', m.color);
      if (m.view) formData.append('view', m.view);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload');
    xhr.withCredentials = true;

    xhr.upload.onprogress = ev => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: pct } : u));
      }
    };

    xhr.onload = async () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.path) {
          setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'done', progress: 100 } : u));
          await onComplete(data.path);
          setTimeout(() => setUploads(prev => prev.filter(u => u.id !== id)), 4000);
        } else {
          const err = data.error ?? `Server error ${xhr.status}`;
          setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error', error: err } : u));
          options?.onError?.(err);
        }
      } catch {
        const err = `Unexpected response (${xhr.status})`;
        setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error', error: err } : u));
        options?.onError?.(err);
      }
    };

    xhr.onerror = () => {
      const err = 'Upload failed';
      setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error', error: err } : u));
      options?.onError?.(err);
    };

    xhr.send(formData);
  }, []);

  return (
    <UploadContext.Provider value={{ uploads, startUpload }}>
      {children}

      {/* Floating indicator */}
      {uploads.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
          {uploads.map(u => (
            <div key={u.id} className="flex w-72 items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
              {/* Icon */}
              <div className="mt-0.5 shrink-0">
                {u.status === 'uploading' && (
                  <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                {u.status === 'done' && (
                  <svg className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="m5 13 4 4L19 7"/>
                  </svg>
                )}
                {u.status === 'error' && (
                  <svg className="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-gray-700">{u.filename}</p>
                  {u.status === 'uploading' && (
                    <span className="shrink-0 text-[11px] text-gray-400">{u.progress}%</span>
                  )}
                  {u.status !== 'uploading' && (
                    <button
                      onClick={() => setUploads(prev => prev.filter(x => x.id !== u.id))}
                      className="shrink-0 text-gray-300 hover:text-gray-500"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="m18 6-12 12M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
                {u.status === 'uploading' && (
                  <div className="mt-1.5 h-1 rounded-full bg-gray-100">
                    <div
                      className="h-1 rounded-full bg-gray-900 transition-all duration-300"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                )}
                {u.status === 'done' && (
                  <p className="mt-0.5 text-[11px] text-green-500">Upload complete</p>
                )}
                {u.status === 'error' && (
                  <p className="mt-0.5 text-[11px] text-red-400">{u.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </UploadContext.Provider>
  );
}
