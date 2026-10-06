import { NextRequest, NextResponse } from 'next/server';
import { getResend, sendWelcomeSubscription } from '@/lib/resend';
import { normaliseEmail, upsertSubscriber, rateLimit } from '@/lib/subscribers';
import { mintCode, findUnusedCode, SIGNUP_DISCOUNT_PERCENT } from '@/lib/discountCodes';

// Marketing capture for the homepage pop-up. Consent-gated, honeypotted, and
// rate-limited per IP and per email (a honeypot alone does not stop
// code-farming). The subscribers table is ground truth; the Resend audience is
// a best-effort mirror.

const IP_MAX_PER_WINDOW = 5;
const EMAIL_MAX_PER_WINDOW = 3;
const WINDOW_MINUTES = 10;

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Honeypot: the field is invisible to humans, so anything in it is a bot.
    // Pretend success and store nothing.
    const honeypot = typeof body.company === 'string' ? body.company.trim() : '';
    if (honeypot) return NextResponse.json({ ok: true });

    const email = normaliseEmail(body.email);
    if (!email) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }
    if (body.consent !== true) {
      return NextResponse.json({ error: 'Please confirm you agree to receive marketing emails' }, { status: 400 });
    }

    const ip = clientIp(req);
    const allowed = await rateLimit(
      'subscribe',
      [
        { key: `ip:${ip}`, max: IP_MAX_PER_WINDOW },
        { key: `email:${email}`, max: EMAIL_MAX_PER_WINDOW },
      ],
      WINDOW_MINUTES
    );
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts — try again in a few minutes' }, { status: 429 });
    }

    const { inserted, reactivated, token } = await upsertSubscriber({
      email,
      brand: 'break',
      source: typeof body.source === 'string' && body.source ? body.source.slice(0, 64) : 'homepage-popup',
    });

    // Already on the list (no re-activation): never reveal an existing code to
    // an unauthenticated request keyed only by an email address — the code
    // lives in their inbox if it is still unused.
    if (!inserted && !reactivated) {
      return NextResponse.json({ ok: true, already: true });
    }

    // Re-activation reuses any still-unused code rather than minting a fresh
    // one each time they toggle their subscription.
    const code = reactivated ? (await findUnusedCode(email)) ?? await mintCode(email) : await mintCode(email);
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://thebreaksurf.co.uk';
    const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${token}`;

    // Resend audience mirror — custom properties differentiate this capture
    // from any future brand/list. Skipped entirely until RESEND_AUDIENCE_ID is
    // configured; the local row above is what actually matters.
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (audienceId) {
      const resend = await getResend();
      await resend.contacts
        .create({
          email,
          audienceId,
          properties: { brand: 'break', source: 'homepage-popup' },
        })
        .catch(err => console.error('[subscribe] resend contact create failed:', err));
    }

    // A re-activated subscriber gets their (possibly fresh) code by email only.
    await sendWelcomeSubscription({
      to: email,
      code,
      percent: SIGNUP_DISCOUNT_PERCENT,
      unsubscribeUrl,
    }).catch(err => console.error('[subscribe] welcome email failed:', err));

    return NextResponse.json({ ok: true, code: inserted ? code : undefined });
  } catch (err) {
    console.error('[subscribe] failed:', err);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
}
