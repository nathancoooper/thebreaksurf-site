import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { uploadToR2, listR2Files, deleteFromR2 } from '@/lib/r2';

// Safari downloads video/quicktime as .qt — normalise to common extensions.
const MIME_EXT: Record<string, string> = {
  'image/jpeg':      '.jpg',
  'image/png':       '.png',
  'image/gif':       '.gif',
  'image/webp':      '.webp',
};

function resolveExt(filename: string, mimeType: string): string {
  const fromName = filename.includes('.') ? '.' + filename.split('.').pop()?.toLowerCase() : '';
  if (!fromName || fromName === '.qt') return MIME_EXT[mimeType] ?? fromName ?? '.bin';
  return fromName;
}

const ALLOWED_TYPES = new Set(['products', 'events', 'posts', 'heroes', 'meetings', 'whiteboards', 'social', 'designs', 'items', 'misc']);

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function nextVersion(prefix: string, base: string): Promise<string> {
  let max = 0;
  try {
    const files = await listR2Files(prefix);
    for (const file of files) {
      const filename = file.key.split('/').pop() ?? '';
      const stem = filename.slice(0, filename.length - (filename.includes('.') ? filename.split('.').pop()?.length ?? 0 : 0) - 1);
      const match = stem.match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_V(\\d+)$`));
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }
  } catch {}
  return `V${String(max + 1).padStart(3, '0')}`;
}

async function buildFilename(fields: Record<string, string>, ext: string, prefix: string): Promise<{ filename: string; subdir: string; base: string | null }> {
  const rawType = fields.type ?? '';
  const subdir = ALLOWED_TYPES.has(rawType) ? rawType : 'misc';
  const name = fields.name?.trim();

  if (!name) {
    return { filename: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`, subdir, base: null };
  }

  const parts = ['thebreaksite', subdir, toSlug(name)];
  if (fields.color) parts.push(toSlug(fields.color));
  if (fields.date) parts.push(fields.date.replace(/-/g, ''));
  parts.push(fields.view ? toSlug(fields.view) : 'cover');

  const base = parts.join('_');
  const version = await nextVersion(`${subdir}/`, base);
  return { filename: `${base}_${version}${ext}`, subdir, base };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error('[upload] formData parse error:', err);
    return NextResponse.json({ error: 'Upload parse failed' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file in request' }, { status: 400 });
  }

  const fields: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (typeof val === 'string') fields[key] = val;
  }

  const ext = resolveExt(file.name, file.type);
  const rawType = fields.type ?? '';
  const subdir = ALLOWED_TYPES.has(rawType) ? rawType : 'misc';
  const { filename, base } = await buildFilename(fields, ext, `${subdir}/`);

  // Delete previous versions of this slot before writing the new file
  if (base) {
    try {
      const files = await listR2Files(`${subdir}/`);
      await Promise.all(
        files
          .filter(f => {
            const fileKey = f.key.split('/').pop() ?? '';
            const stem = fileKey.slice(0, fileKey.length - (fileKey.includes('.') ? fileKey.split('.').pop()?.length ?? 0 : 0) - 1);
            return stem === base || stem.startsWith(base + '_');
          })
          .map(f => deleteFromR2(f.key).catch(() => {}))
      );
    } catch {}
  }

  const key = `${subdir}/${filename}`;
  const content = await file.arrayBuffer();

  try {
    await uploadToR2(key, content, file.type);
  } catch (err) {
    console.error('[upload] R2 upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  return NextResponse.json({ path: `/api/r2/${key}` });
}
