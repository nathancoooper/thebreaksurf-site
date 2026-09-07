'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';

const ERP_URL = process.env.NEXT_PUBLIC_ERPNEXT_URL ?? 'https://www.erpnext.nathanjohncooper.co.uk';

interface ProjectDetail { name: string; project_name: string; status: string; notes: string | null }
interface ProjectEntry { doctype: string; name: string; date: string; amount: number; party: string }
interface Task { name: string; subject: string; status: string; priority: string; description: string | null }
interface ProjectFile { name: string; file_name: string; file_url: string; creation: string }

const TASK_STATUSES = ['Open', 'Working', 'Pending Review', 'Completed', 'Cancelled'];

function fmt(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function erpEntryUrl(doctype: string, name: string): string {
  const slug = doctype === 'Purchase Order' ? 'purchase-order' : 'sales-invoice';
  return `${ERP_URL}/app/${slug}/${encodeURIComponent(name)}`;
}

export default function ProjectDetailPage() {
  const params = useParams<{ name: string }>();
  const pathname = usePathname();
  const projectName = decodeURIComponent(params.name);
  const projectsPath = pathname.startsWith('/admin')
    ? '/admin/projects'
    : pathname.startsWith('/finance')
      ? '/finance/projects'
      : '/projects';

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [entries, setEntries] = useState<ProjectEntry[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [cost, setCost] = useState(0);
  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notesSaving, setNotesSaving] = useState(false);

  const loadProject = useCallback(async () => {
    const r = await fetch(`/api/admin/projects/${encodeURIComponent(projectName)}`, { credentials: 'include' });
    if (r.ok) {
      const d = await r.json();
      setProject(d.project);
      setEntries(d.entries ?? []);
      setRevenue(d.revenue ?? 0);
      setCost(d.cost ?? 0);
    }
    setLoading(false);
  }, [projectName]);

  const loadTasks = useCallback(async () => {
    const r = await fetch(`/api/admin/projects/${encodeURIComponent(projectName)}/tasks`, { credentials: 'include' });
    if (r.ok) setTasks((await r.json()).tasks ?? []);
  }, [projectName]);

  const loadFiles = useCallback(async () => {
    const r = await fetch(`/api/admin/projects/${encodeURIComponent(projectName)}/files`, { credentials: 'include' });
    if (r.ok) setFiles((await r.json()).files ?? []);
  }, [projectName]);

  useEffect(() => { loadProject(); loadTasks(); loadFiles(); }, [loadProject, loadTasks, loadFiles]);

  async function createTask() {
    if (!newTask.trim()) return;
    setCreatingTask(true);
    const r = await fetch(`/api/admin/projects/${encodeURIComponent(projectName)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subject: newTask.trim() }),
    });
    if (r.ok) {
      const task = await r.json();
      setTasks(prev => [{ name: task.name, subject: task.subject, status: task.status, priority: task.priority, description: task.description }, ...prev]);
      setNewTask('');
    }
    setCreatingTask(false);
  }

  async function toggleTaskDone(task: Task) {
    const status = task.status === 'Completed' ? 'Open' : 'Completed';
    setTasks(prev => prev.map(t => t.name === task.name ? { ...t, status } : t));
    await fetch(`/api/admin/projects/${encodeURIComponent(projectName)}/tasks/${encodeURIComponent(task.name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
  }

  async function saveNotes(notes: string) {
    setNotesSaving(true);
    await fetch(`/api/admin/projects/${encodeURIComponent(projectName)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notes }),
    });
    setNotesSaving(false);
  }

  async function uploadFile(file: globalThis.File) {
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const r = await fetch(`/api/admin/projects/${encodeURIComponent(projectName)}/files`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (r.ok) {
      const uploaded = await r.json();
      setFiles(prev => [{ name: uploaded.name, file_name: uploaded.file_name, file_url: uploaded.file_url, creation: new Date().toISOString() }, ...prev]);
    }
    setUploading(false);
  }

  if (loading) return <div className="p-8"><p className="text-sm text-gray-400">Loading…</p></div>;
  if (!project) return <div className="p-8"><p className="text-sm text-gray-400">Project not found.</p></div>;

  return (
    <div className="flex h-full flex-col overflow-hidden p-8">
      <div className="mb-6 shrink-0">
        <Link href={projectsPath} className="mb-2 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          Projects
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">{project.project_name}</h1>
      </div>

      <div className="mb-6 grid shrink-0 grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{fmt(revenue)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Cost</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{fmt(cost)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Margin</p>
          <p className={`mt-2 text-2xl font-semibold ${revenue - cost >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(revenue - cost)}</p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.4fr] gap-6">
        {/* Left: Tasks + Notes */}
        <div className="flex min-h-0 flex-col gap-6">
          <div className="flex min-h-0 flex-[3] flex-col rounded-2xl border border-gray-100 bg-white p-5">
            <p className="mb-3 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">Tasks</p>
            <div className="mb-3 flex shrink-0 gap-2">
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createTask(); }}
                placeholder="Add a task…"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
              />
              <button
                onClick={createTask}
                disabled={creatingTask || !newTask.trim()}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks yet.</p>
            ) : (
              <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto">
                {tasks.map(task => (
                  <div key={task.name} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                    <button
                      onClick={() => toggleTaskDone(task)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        task.status === 'Completed' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-transparent hover:border-gray-400'
                      }`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <span className={`flex-1 text-sm ${task.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.subject}</span>
                    {task.status !== 'Completed' && task.status !== 'Open' && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{task.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-[2] flex-col rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</p>
              {notesSaving && <span className="text-[10px] text-gray-300">Saving…</span>}
            </div>
            <textarea
              defaultValue={project.notes ?? ''}
              onBlur={e => saveNotes(e.target.value)}
              placeholder="Notes about this job…"
              className="flex-1 min-h-0 resize-none overflow-y-auto rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Right: Linked entries + Files */}
        <div className="flex min-h-0 flex-col gap-6">
          <div className="flex min-h-0 flex-[3] flex-col rounded-2xl border border-gray-100 bg-white p-5">
            <p className="mb-3 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">Linked entries</p>
            {entries.length === 0 ? (
              <p className="text-sm text-gray-400">No Sales Invoices or Purchase Orders tagged to this project yet.</p>
            ) : (
              <div className="flex-1 min-h-0 space-y-1 overflow-y-auto">
                {entries.map(entry => (
                  <a
                    key={`${entry.doctype}:${entry.name}`}
                    href={erpEntryUrl(entry.doctype, entry.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 underline-offset-2 hover:underline">{entry.name}</p>
                      <p className="text-xs text-gray-400">{entry.doctype} · {fmtDate(entry.date)} · {entry.party}</p>
                    </div>
                    <p className={`shrink-0 text-sm font-medium ${entry.doctype === 'Sales Invoice' ? 'text-green-700' : 'text-gray-900'}`}>{fmt(entry.amount)}</p>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-[2] flex-col rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Files</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {uploading ? 'Uploading…' : '+ Upload file'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            {files.length === 0 ? (
              <p className="text-sm text-gray-400">No files uploaded — designs, quotes, or anything else related to this job.</p>
            ) : (
              <div className="flex-1 min-h-0 space-y-1 overflow-y-auto">
                {files.map(f => (
                  <a
                    key={f.name}
                    href={`${ERP_URL}${f.file_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50"
                  >
                    <p className="truncate text-sm text-gray-700 underline-offset-2 hover:underline">{f.file_name}</p>
                    <p className="shrink-0 text-xs text-gray-400">{fmtDate(f.creation)}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
