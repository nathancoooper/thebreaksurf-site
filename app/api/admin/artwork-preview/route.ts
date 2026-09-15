import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { isVectorFile, rasteriseVectorPreview } from '@/lib/vectorRaster';

// Browsers can't decode EPS/AI/PDF, so the designs dialog asks the server for a
// low-res raster to preview and to learn the artwork's proportions — which is
// what lets one print dimension fill in the other.
export async function POST(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file in request' }, { status: 400 });
  }
  if (!isVectorFile(file.name)) {
    return NextResponse.json({ error: 'Only EPS, AI, PS and PDF need measuring' }, { status: 400 });
  }

  const result = await rasteriseVectorPreview(Buffer.from(await file.arrayBuffer()));
  if (!result) {
    return NextResponse.json(
      { error: "Couldn't read that file. Re-export it from Illustrator as an EPS with the artwork on the artboard." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    width: result.width,
    height: result.height,
    preview: `data:image/png;base64,${result.png.toString('base64')}`,
  });
}
