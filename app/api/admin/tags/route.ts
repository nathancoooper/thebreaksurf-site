import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { getUnprintedSummary, getUnprintedSerials, buildTagData, markPrinted } from '@/lib/serials';

// GET /api/admin/tags              → per-item counts of untagged stock
// GET /api/admin/tags?item=<code>  → printable tag data for that item's unprinted serials
export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  const item = request.nextUrl.searchParams.get('item');
  if (!item) {
    return NextResponse.json({ items: await getUnprintedSummary() });
  }

  const serials = await getUnprintedSerials(item);
  return NextResponse.json({ itemCode: item, tags: serials.map(buildTagData) });
}

// POST /api/admin/tags { serials: string[] } → record tags as printed
export async function POST(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  const body = await request.json().catch(() => null);
  const serials = body?.serials;
  if (!Array.isArray(serials) || serials.length === 0 || serials.some(s => typeof s !== 'string')) {
    return NextResponse.json({ error: 'serials must be a non-empty array of strings' }, { status: 400 });
  }
  if (serials.length > 2000) {
    return NextResponse.json({ error: 'too many serials in one batch' }, { status: 400 });
  }

  const marked = markPrinted(serials);
  return NextResponse.json({ ok: true, marked });
}
