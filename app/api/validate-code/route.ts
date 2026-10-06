import { NextRequest, NextResponse } from 'next/server';
import { normaliseEmail, rateLimit } from '@/lib/subscribers';
import { validateCode } from '@/lib/discountCodes';

// Cart-side code check. Requires BOTH the code and the address it was issued
// to — the same gate the checkout route re-runs server-side. Unknown,
// used-up, and wrong-address codes all return one generic error so this can't
// be used to enumerate codes; per-IP and per-code rate limits slow guessing.

const IP_MAX_PER_WINDOW = 10;
const CODE_MAX_PER_WINDOW = 10;
const WINDOW_MINUTES = 10;

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const code = body && typeof body === 'object' && typeof body.code === 'string' ? body.code.trim() : '';
    const email = body && typeof body === 'object' ? normaliseEmail(body.email) : null;

    if (!code || !email) {
      return NextResponse.json({ error: 'Enter your code and the email you signed up with' }, { status: 400 });
    }

    const allowed = await rateLimit(
      'validate',
      [
        { key: `ip:${clientIp(req)}`, max: IP_MAX_PER_WINDOW },
        { key: `code:${code.toUpperCase()}`, max: CODE_MAX_PER_WINDOW },
      ],
      WINDOW_MINUTES
    );
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts — try again in a few minutes' }, { status: 429 });
    }

    const valid = await validateCode(code, email);
    if (!valid) {
      return NextResponse.json({ error: 'That code or email isn\'t valid' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, code: valid.code, email, percent: valid.percent });
  } catch (err) {
    console.error('[validate-code] failed:', err);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
}
