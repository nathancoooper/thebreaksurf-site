import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { erpList } from '@/lib/erpnext';

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const [brands, attributes, itemGroups] = await Promise.all([
    erpList<{ name: string }>('Brand', { fields: ['name'], orderBy: 'name asc', limit: 50 }),
    erpList<{ name: string }>('Item Attribute', { fields: ['name'], orderBy: 'name asc', limit: 50 }),
    erpList<{ name: string }>('Item Group', { fields: ['name'], filters: [['is_group', '=', 0]], orderBy: 'name asc', limit: 50 }),
  ]);

  return NextResponse.json({
    brands: brands.map(b => b.name),
    attributes: attributes.map(a => a.name),
    itemGroups: itemGroups.map(g => g.name),
  });
}
