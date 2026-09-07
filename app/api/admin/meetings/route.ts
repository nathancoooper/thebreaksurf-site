import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData, writeData } from '@/lib/dataCache';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  whiteboardId: string | null;
  videoPath: string | null;
  compressedPath: string | null;
  status: 'pending' | 'uploaded' | 'compressing' | 'ready' | 'error';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  return NextResponse.json(await readData<Meeting>('meetings'));
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const meeting: Meeting = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: body.title.trim(),
    date: body.date ?? new Date().toISOString().slice(0, 10),
    attendees: body.attendees ?? [],
    whiteboardId: body.whiteboardId ?? null,
    videoPath: null,
    compressedPath: null,
    status: 'pending',
    errorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeData('meetings', meeting);
  return NextResponse.json(meeting, { status: 201 });
}
