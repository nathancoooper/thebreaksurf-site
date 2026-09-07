import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList } from '@/lib/erpnext';

const BASE = process.env.ERPNEXT_URL!;
const TOKEN = `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;

  const files = await erpList<{ name: string; file_name: string; file_url: string; creation: string }>('File', {
    fields: ['name', 'file_name', 'file_url', 'creation'],
    filters: [['attached_to_doctype', '=', 'Project'], ['attached_to_name', '=', name]],
    orderBy: 'creation desc',
    limit: 200,
  });

  return NextResponse.json({ files });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;

  const incoming = await req.formData();
  const file = incoming.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const form = new FormData();
  form.append('file', file, file.name);
  form.append('doctype', 'Project');
  form.append('docname', name);
  form.append('is_private', '1');

  const res = await fetch(`${BASE}/api/method/upload_file`, {
    method: 'POST',
    headers: { Authorization: TOKEN },
    body: form,
  });

  const data = await res.json();
  if (!res.ok || data.exc) return NextResponse.json({ error: data.exc ?? 'Upload failed' }, { status: 500 });

  return NextResponse.json({ name: data.message?.name, file_name: data.message?.file_name, file_url: data.message?.file_url });
}
