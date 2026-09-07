import { NextRequest, NextResponse } from 'next/server';
import { downloadFromR2 } from '@/lib/r2';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const key = segments.join('/');
  
  try {
    const file = await downloadFromR2(key);
    if (!file) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(file.content, {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
