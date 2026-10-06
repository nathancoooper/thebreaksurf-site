import { NextRequest, NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { unsubscribeByToken } from '@/lib/subscribers';

// Marketing-only unsubscribe, reached from the link in newsletter emails.
// Flips the MariaDB flag (ground truth) and, best-effort, the Resend contact.
// Order/dispatch/review mail never goes through the audience, so this can
// never mute transactional email.

function page(title: string, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — The Break Surf</title></head>
<body style="margin:0;padding:48px 16px;background:#f5f2ec;font-family:Arial,sans-serif;color:#1c1c1c;text-align:center;">
  <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#c4622d;">The Break Surf</p>
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:500;font-size:28px;">${title}</h1>
  <p style="margin:0 auto 24px;max-width:440px;font-size:14px;line-height:1.6;color:#666;">${message}</p>
  <a href="https://thebreaksurf.co.uk" style="display:inline-block;background:#c4622d;color:#f2ede3;text-decoration:none;font-size:13px;font-weight:600;padding:12px 28px;border-radius:3px;">Back to the shop</a>
</body>
</html>`;
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  let email: string | null = null;

  try {
    email = await unsubscribeByToken(token);
  } catch (err) {
    console.error('[unsubscribe] failed:', err);
    return page('Something went wrong', 'We couldn\'t process that link just now — please try again in a moment, or email nathan@thebreaksurf.co.uk.');
  }

  if (!email) {
    return page('Link not valid', 'This unsubscribe link has already been used or is no longer valid. If you still want to come off the list, email nathan@thebreaksurf.co.uk.');
  }

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (audienceId) {
    const resend = await getResend();
    await resend.contacts
      .update({ email, audienceId, unsubscribed: true })
      .catch(err => console.error('[unsubscribe] resend contact update failed:', err));
  }

  return page('You\'re unsubscribed', 'You won\'t get any more marketing emails from us. Order confirmations, dispatch notices and review requests are unaffected — those still arrive as normal.');
}
