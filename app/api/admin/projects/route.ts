import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList, erpCreate } from '@/lib/erpnext';

interface ProjectStats {
  name: string;
  project_name: string;
  revenue: number;
  cost: number;
  margin: number;
  invoiceCount: number;
  orderCount: number;
}

// Scratch projects created while testing this feature can't actually be
// deleted — ERPNext refuses once a GL Entry references them, and GL Entry
// itself is permission-locked against edits even for admins, by design (it's
// meant to be a permanently immutable ledger). Naming a throwaway project
// TEST_PROJECT_V### keeps it out of the way everywhere in this admin panel
// without touching the ledger.
const TEST_PROJECT_PATTERN = /^TEST_PROJECT_V\d+$/i;

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const allProjects = await erpList<{ name: string; project_name: string }>('Project', {
    fields: ['name', 'project_name'],
    orderBy: 'creation desc',
    limit: 200,
  });
  const projects = allProjects.filter(p => !TEST_PROJECT_PATTERN.test(p.project_name));

  // Revenue/cost are computed directly from whichever Sales Invoices and
  // Purchase Orders are tagged with each project, rather than ERPNext's
  // built-in Project billing fields — those expect Timesheet-based project
  // billing, which isn't how this business tracks custom-order jobs.
  const [invoices, orders] = await Promise.all([
    erpList<{ project: string; grand_total: number }>('Sales Invoice', {
      fields: ['project', 'grand_total'],
      filters: [['project', 'is', 'set'], ['docstatus', '=', 1]],
      limit: 1000,
    }),
    erpList<{ project: string; grand_total: number }>('Purchase Order', {
      fields: ['project', 'grand_total'],
      filters: [['project', 'is', 'set'], ['docstatus', '=', 1]],
      limit: 1000,
    }),
  ]);

  const stats: ProjectStats[] = projects.map(p => {
    const projectInvoices = invoices.filter(i => i.project === p.name);
    const projectOrders = orders.filter(o => o.project === p.name);
    const revenue = projectInvoices.reduce((sum, i) => sum + i.grand_total, 0);
    const cost = projectOrders.reduce((sum, o) => sum + o.grand_total, 0);
    return {
      name: p.name,
      project_name: p.project_name,
      revenue,
      cost,
      margin: revenue - cost,
      invoiceCount: projectInvoices.length,
      orderCount: projectOrders.length,
    };
  });

  return NextResponse.json({ projects: stats });
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json() as { project_name?: string };

  if (!body.project_name?.trim()) {
    return NextResponse.json({ error: 'project_name is required' }, { status: 400 });
  }

  const project = await erpCreate<{ name: string; project_name: string }>('Project', {
    project_name: body.project_name.trim(),
  });

  return NextResponse.json(project);
}
