import { NextRequest, NextResponse } from 'next/server';
import { downloadFromR2 } from '@/lib/r2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const key = path.join('/');
  
  if (!key) {
    return NextResponse.json({ error: 'File path is required' }, { status: 400 });
  }

  try {
    const file = await downloadFromR2(key);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return new NextResponse(file.content, {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[r2] Error serving file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
