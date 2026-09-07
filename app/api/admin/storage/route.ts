import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { listR2Files } from '@/lib/r2';

interface Category { name: string; prefixes: string[] }

// Blob keys are stored as `<category>/<filename>` (products/, events/,
// heroes/, posts/, misc/). Compute usage by listing each category's prefix.
const CATEGORIES: Category[] = [
  { name: 'Products', prefixes: ['products'] },
  { name: 'Events', prefixes: ['events'] },
  { name: 'Heroes', prefixes: ['heroes'] },
  { name: 'Posts / Writing', prefixes: ['posts'] },
  { name: 'Meetings', prefixes: ['meetings'] },
  { name: 'Social posts', prefixes: ['social'] },
  { name: 'University', prefixes: ['university'] },
  { name: 'Receipts', prefixes: ['receipts'] },
  { name: 'Email attachments', prefixes: ['email-attachments'] },
  { name: 'Designs', prefixes: ['designs'] },
  { name: 'Other uploads', prefixes: ['misc'] },
];

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const categories = await Promise.all(
    CATEGORIES.map(async c => {
      let bytes = 0;
      for (const prefix of c.prefixes) {
        for (const f of await listR2Files(prefix)) bytes += f.size;
      }
      return { name: c.name, bytes };
    })
  );

  const totalBytes = categories.reduce((sum, c) => sum + c.bytes, 0);
  return NextResponse.json({ categories, totalBytes });
}
