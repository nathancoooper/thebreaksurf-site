import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readSetting, writeSetting } from '@/lib/dataCache';

export type ItemImages = Record<string, string>;

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const data = await readSetting<ItemImages>('item_images', 'data');
  return NextResponse.json(data ?? {});
}

export async function PUT(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json() as { key?: string; imageUrl?: string | null };

  if (!body.key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  const data = (await readSetting<ItemImages>('item_images', 'data')) ?? {};
  if (body.imageUrl) {
    data[body.key] = body.imageUrl;
  } else {
    delete data[body.key];
  }

  try {
    await writeSetting('item_images', 'data', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to save item image', error);
    return NextResponse.json({ error: 'The image reference could not be saved. Please try again.' }, { status: 500 });
  }
}
