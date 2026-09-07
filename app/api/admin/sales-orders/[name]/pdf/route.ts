import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';

const PRINT_FORMAT = 'Sales Order with Banking Details';
const LETTER_HEAD = 'Sales Order Export Letterhead';

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const { name } = await params;

  const query = new URLSearchParams({
    doctype: 'Sales Order',
    name,
    format: PRINT_FORMAT,
    letterhead: LETTER_HEAD,
    // This dedicated letterhead embeds the private company SVG so ERPNext's
    // headless PDF renderer can load it without a browser login session.
    no_letterhead: '0',
  });

  try {
    const response = await fetch(
      `${process.env.ERPNEXT_URL}/api/method/frappe.utils.print_format.download_pdf?${query}`,
      {
        headers: {
          Authorization: `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`ERPNext ${response.status}: ${detail}`);
    }

    const filename = `${name.replace(/[^A-Za-z0-9._-]/g, '-')}.pdf`;
    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(`Failed to export sales order ${name} as PDF`, error);
    return NextResponse.json(
      { error: 'ERPNext could not generate this Sales Order PDF.' },
      { status: 502 },
    );
  }
}
