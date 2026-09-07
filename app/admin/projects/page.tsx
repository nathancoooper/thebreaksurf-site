'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Project {
  name: string;
  project_name: string;
  revenue: number;
  cost: number;
  margin: number;
  invoiceCount: number;
  orderCount: number;
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

export default function ProjectsPage() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const projectsPath = pathname.startsWith('/admin')
    ? '/admin/projects'
    : pathname.startsWith('/finance')
      ? '/finance/projects'
      : '/projects';

  useEffect(() => {
    fetch('/api/admin/projects', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = projects.reduce((s, p) => s + p.revenue, 0);
  const totalCost = projects.reduce((s, p) => s + p.cost, 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-400">Custom orders and jobs, tagged from Sales Invoices and Purchase Orders in Bank transactions.</p>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && projects.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Total Revenue</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{fmt(totalRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Total Cost</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{fmt(totalCost)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Total Margin</p>
            <p className={`mt-2 text-2xl font-semibold ${totalRevenue - totalCost >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(totalRevenue - totalCost)}</p>
          </div>
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">No projects yet — tag a Sales Invoice or Purchase Order with a project from Bank transactions to create one.</p>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="grid grid-cols-[1fr_100px_100px_100px_90px_90px] gap-4 border-b border-gray-100 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <span>Project</span>
            <span className="text-right">Revenue</span>
            <span className="text-right">Cost</span>
            <span className="text-right">Margin</span>
            <span className="text-right">Invoices</span>
            <span className="text-right">Orders</span>
          </div>
          {projects.map((p, i) => (
            <Link
              key={p.name}
              href={`${projectsPath}/${encodeURIComponent(p.name)}`}
              className={`grid grid-cols-[1fr_100px_100px_100px_90px_90px] items-center gap-4 px-6 py-3.5 transition-colors hover:bg-gray-50 ${i < projects.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <p className="text-sm font-medium text-gray-900">{p.project_name}</p>
              <p className="text-right text-sm text-gray-700">{fmt(p.revenue)}</p>
              <p className="text-right text-sm text-gray-700">{fmt(p.cost)}</p>
              <p className={`text-right text-sm font-medium ${p.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(p.margin)}</p>
              <p className="text-right text-sm text-gray-400">{p.invoiceCount}</p>
              <p className="text-right text-sm text-gray-400">{p.orderCount}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
