import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readSetting, writeSetting } from '@/lib/dataCache';

export interface ItemCategories {
  categories: string[];
  families: Record<string, string>;
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const data = await readSetting<ItemCategories>('item_categories', 'data');
  return NextResponse.json(data ?? { categories: [], families: {} });
}

export async function PUT(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();

  if (!body.family) {
    return NextResponse.json({ error: 'family is required' }, { status: 400 });
  }

  const data = (await readSetting<ItemCategories>('item_categories', 'data')) ?? { categories: [], families: {} };
  const category = (body.category ?? '').trim();

  if (category) {
    data.families[body.family] = category;
    if (!data.categories.includes(category)) data.categories.push(category);
  } else {
    delete data.families[body.family];
  }

  try {
    await writeSetting('item_categories', 'data', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to save item categories', error);
    return NextResponse.json({ error: 'The category could not be saved. Please try again.' }, { status: 500 });
  }
}
