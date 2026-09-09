import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { ensurePickupToken, getSubmission } from '@/lib/universitySubmissions';
import { getResend, FROM_EMAIL, REPLY_TO, pickupReadyHtml } from '@/lib/resend';

// Mark-ready + send the student their pickup-booking link (V001: admin taps
// this when the garment is embroidered; the email holds the /pickup/[token]
// link and the student picks a slot in the 7-day view).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireAdminFromRequest(request)) return unauthorised();
  const { id } = await params;
  const current = await getSubmission(id);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const submission = await ensurePickupToken(id);
  if (!submission?.pickupToken) return NextResponse.json({ error: 'Could not issue link' }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thebreaksurf.co.uk';
  const pickupUrl = `${appUrl}/pickup/${submission.pickupToken}`;

  let emailed = false;
  try {
    await (await getResend()).emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: submission.studentEmail,
      subject: `Your ${submission.garment} is ready — pick a pick-up slot`,
      html: pickupReadyHtml({
        studentName: submission.studentName,
        garment: submission.garment,
        pickupUrl,
      }),
    });
    emailed = true;
  } catch { /* link below still works — admin can forward it manually */ }

  return NextResponse.json({ ok: true, emailed, pickupUrl });
}
