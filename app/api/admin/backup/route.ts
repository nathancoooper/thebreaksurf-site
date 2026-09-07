import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData } from '@/lib/dataCache';

const TABLES = [
  'products', 'events', 'heroes', 'promotions', 'reviews', 'orders',
  'item_categories', 'item_images', 'nesting_sheets', 'designs',
  'tag_prints', 'post_redirects', 'stats', 'users', 'passkeys',
  'login_log', 'email_messages', 'email_contacts', 'email_push_subscriptions',
  'email_settings', 'agent_settings', 'outreach', 'outreach_leads',
  'assistant_tasks', 'receipt_settings', 'finance_remark_rules',
  'supplier_aliases', 'supplier_item_mappings', 'social_posts',
  'meetings', 'tasks', 'people', 'whiteboards', 'university_submissions',
  'receipts', 'stock_snapshot',
];

export async function GET(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  const files: Record<string, unknown> = {};
  for (const table of TABLES) {
    try {
      const data = await readData(table);
      if (data.length > 0) files[`${table}.json`] = data;
    } catch {
      // skip tables that don't exist
    }
  }

  const backup = {
    version: 1,
    createdAt: new Date().toISOString(),
    files,
  };

  const json = JSON.stringify(backup, null, 2);
  const date = new Date().toISOString().split('T')[0];

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="tbs-backup-${date}.json"`,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!await requireAdminFromRequest(request)) return unauthorised();

  let backup: { version: number; files: Record<string, unknown> };
  try {
    backup = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (backup.version !== 1 || typeof backup.files !== 'object') {
    return NextResponse.json({ error: 'Unrecognised backup format' }, { status: 400 });
  }

  // Restore is not supported on Cloudflare — D1 has built-in backups
  return NextResponse.json({ error: 'Restore is not supported on Cloudflare. Use D1 backups instead.' }, { status: 501 });
}
