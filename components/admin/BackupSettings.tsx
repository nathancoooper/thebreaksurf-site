'use client';

import { useEffect, useRef, useState } from 'react';

interface FullBackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

interface BackupAreaInfo {
  id: string;
  label: string;
  description: string;
  entryCount: number;
}

function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

export default function BackupSettings() {
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullBackups, setFullBackups] = useState<FullBackupInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<FullBackupInfo | null>(null);
  const [backupAreas, setBackupAreas] = useState<BackupAreaInfo[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [restoringArchive, setRestoringArchive] = useState(false);

  async function loadFullBackups() {
    const res = await fetch('/api/admin/backup/full', { credentials: 'include' });
    if (res.ok) setFullBackups(await res.json());
    setLoadingBackups(false);
  }

  useEffect(() => {
    fetch('/api/admin/backup/full', { credentials: 'include' })
      .then(async res => {
        if (res.ok) setFullBackups(await res.json());
      })
      .finally(() => setLoadingBackups(false));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/backup/full', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Backup failed');
      setMessage({ type: 'ok', text: `Created ${data.filename} (${formatSize(data.sizeBytes)}).` });
      await loadFullBackups();
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Backup failed' });
    } finally {
      setGenerating(false);
    }
  }

  async function openBackup(backup: FullBackupInfo) {
    setSelectedBackup(backup);
    setBackupAreas([]);
    setSelectedAreas([]);
    setLoadingAreas(true);
    try {
      const res = await fetch(`/api/admin/backup/full?inspect=${encodeURIComponent(backup.filename)}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not inspect backup');
      setBackupAreas(data.areas);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Could not inspect backup' });
      setSelectedBackup(null);
    } finally {
      setLoadingAreas(false);
    }
  }

  async function restoreArchiveAreas(areaIds: string[]) {
    if (!selectedBackup || areaIds.length === 0) return;
    const areaNames = backupAreas.filter(area => areaIds.includes(area.id)).map(area => area.label);
    const description = areaIds.length === backupAreas.length ? 'all application data' : areaNames.join(', ');
    if (!window.confirm(`Restore ${description} from ${new Date(selectedBackup.createdAt).toLocaleString('en-GB')}? Current data in those areas will be replaced. A fresh safety backup will be created first.`)) return;

    setRestoringArchive(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/backup/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'restore', filename: selectedBackup.filename, areas: areaIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Restore failed');
      setMessage({
        type: 'ok',
        text: `Restored ${description}. Safety backup created: ${data.safetyBackup.filename}.`,
      });
      setSelectedBackup(null);
      await loadFullBackups();
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Restore failed' });
    } finally {
      setRestoringArchive(false);
    }
  }

  async function handleDownload() {
    const res = await fetch('/api/admin/backup', { credentials: 'include' });
    if (!res.ok) { setMessage({ type: 'err', text: 'Download failed' }); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setMessage(null);
    try {
      const text = await file.text();
      const res  = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Restore failed');
      setMessage({ type: 'ok', text: `Restored ${data.restored.length} file${data.restored.length === 1 ? '' : 's'}.` });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Restore failed' });
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-base font-semibold text-gray-900">Backup &amp; Restore</h2>
      <p className="mb-5 max-w-3xl text-sm text-gray-500">
        Download or restore a lightweight JSON backup of your data files, or generate a full site archive.
      </p>

      {message && (
        <div className={`mb-6 rounded-md px-4 py-3 text-sm ${
          message.type === 'ok'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Download & Restore side-by-side */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Download backup</h2>
          <p className="mb-4 text-xs text-gray-500">
            Generates a single JSON file containing all your data. Store it somewhere safe.
          </p>
          <button
            onClick={handleDownload}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Download backup
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Restore from backup</h2>
          <p className="mb-4 text-xs text-gray-500">
            Upload a backup file to overwrite current data. This cannot be undone — download a fresh backup first if you want to keep the current state.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestore}
            className="hidden"
            id="restore-file"
          />
          <label
            htmlFor="restore-file"
            className={`inline-block cursor-pointer rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 ${
              restoring ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {restoring ? 'Restoring…' : 'Choose backup file'}
          </label>
        </div>
      </div>

      {/* Full site backup - full width */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Full site backup</h2>
        <p className="mb-4 text-xs text-gray-500">
          A single .tar.gz containing data/, content/posts/, public/images/uploads/, your .env.production
          secrets, and the crontab this site needs. Runs automatically every night at 5am, and keeps the
          7 most recent — download one below, or generate a fresh one now.
          <span className="mt-1 block font-medium text-amber-700">
            Contains live secrets — store it somewhere secure, not a public or shared location.
          </span>
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="mb-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate backup now'}
        </button>
        {loadingBackups ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : fullBackups.length === 0 ? (
          <p className="text-xs text-gray-400">No backups yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
            {fullBackups.map(b => (
              <li key={b.filename} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <button type="button" onClick={() => openBackup(b)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium text-gray-800">{new Date(b.createdAt).toLocaleString('en-GB')}</p>
                  <p className="text-gray-400">{formatSize(b.sizeBytes)} · Select restore areas</p>
                </button>
                <a
                  href={`/api/admin/backup/full?download=${encodeURIComponent(b.filename)}`}
                  className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/30 p-4" onMouseDown={() => !restoringArchive && setSelectedBackup(null)}>
          <div className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Restore backup</h3>
                <p className="mt-1 text-xs text-gray-500">{new Date(selectedBackup.createdAt).toLocaleString('en-GB')} · {formatSize(selectedBackup.sizeBytes)}</p>
              </div>
              <button type="button" disabled={restoringArchive} onClick={() => setSelectedBackup(null)} className="text-xl leading-none text-gray-400 hover:text-gray-700 disabled:opacity-40">×</button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
              {loadingAreas ? (
                <p className="py-8 text-center text-sm text-gray-400">Reading backup contents…</p>
              ) : (
                <div className="space-y-1">
                  {backupAreas.map(area => {
                    const checked = selectedAreas.includes(area.id);
                    return (
                      <label key={area.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={restoringArchive}
                          onChange={() => setSelectedAreas(current => checked ? current.filter(id => id !== area.id) : [...current, area.id])}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-gray-900"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-800">{area.label}</span>
                          <span className="block text-xs text-gray-400">{area.description} · {area.entryCount} archived {area.entryCount === 1 ? 'entry' : 'entries'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                disabled={loadingAreas || restoringArchive || backupAreas.length === 0}
                onClick={() => restoreArchiveAreas(backupAreas.map(area => area.id))}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                {restoringArchive ? 'Restoring…' : 'Restore everything'}
              </button>
              <div className="flex items-center gap-3">
                <button type="button" disabled={restoringArchive} onClick={() => setSelectedBackup(null)} className="px-2 py-2 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-40">Cancel</button>
                <button
                  type="button"
                  disabled={loadingAreas || restoringArchive || selectedAreas.length === 0}
                  onClick={() => restoreArchiveAreas(selectedAreas)}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                >
                  {restoringArchive ? 'Restoring…' : `Restore selected${selectedAreas.length ? ` (${selectedAreas.length})` : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
