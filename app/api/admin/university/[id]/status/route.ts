import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { setSubmissionStatus } from '@/lib/universitySubmissions';
import { SubmissionStatus } from '@/types';

const VALID: SubmissionStatus[] = ['submitted', 'received', 'embroidering', 'ready', 'booked', 'collected'];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const { status } = await request.json();
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const updated = await setSubmissionStatus(id, status);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}
