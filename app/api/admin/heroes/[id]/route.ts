import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { saveHero } from '@/lib/heroes';
import { revalidatePath } from 'next/cache';
import { purgeAndWarm } from '@/lib/cloudflareCache';
import { uploadToR2, deleteFromR2, listR2Files } from '@/lib/r2';

const HERO_PATHS: Record<string, string> = {
  home: '/',
  about: '/about',
  environment: '/environment',
  university: '/university',
};

function revalidateHero(id: string) {
  const p = HERO_PATHS[id];
  if (!p) return;
  revalidatePath(p);
  purgeAndWarm([p]).catch(() => {});
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = `thebreaksite_heroes_${slug(id)}_cover`;
    const prefix = `uploads/heroes/`;

    // Delete any previous version of this hero's image
    const existing = await listR2Files(prefix);
    for (const obj of existing) {
      if (obj.key.split('/').pop()?.startsWith(base)) {
        await deleteFromR2(obj.key).catch(() => {});
      }
    }

    const filename = `${base}_${Date.now()}.${ext}`;
    const key = `${prefix}${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(key, buffer, file.type || 'image/jpeg');

    const hero = await saveHero(id, { image: `/images/uploads/heroes/${filename}` });
    revalidateHero(id);
    return NextResponse.json(hero);
  }

  const body = await request.json();
  const hero = await saveHero(id, body);
  revalidateHero(id);
  return NextResponse.json(hero);
}
