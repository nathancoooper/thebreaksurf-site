import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import { getSessionUser } from '@/lib/adminAuth';
import { verifySession } from '@/lib/auth';
import { addPasskey, findPasskey, passkeyRelyingParty } from '@/lib/passkeys';

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await request.json() as { response?: RegistrationResponseJSON; state?: string; name?: string };
  if (!body.response || !body.state) return NextResponse.json({ error: 'Invalid passkey response' }, { status: 400 });

  try {
    const state = await verifySession(body.state);
    if (state.purpose !== 'passkey-registration' || state.sub !== user.id || typeof state.challenge !== 'string') {
      return NextResponse.json({ error: 'Passkey setup expired' }, { status: 400 });
    }
    const { rpID, expectedOrigin } = passkeyRelyingParty(request);
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: state.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Passkey could not be verified' }, { status: 400 });
    }
    const { credential } = verification.registrationInfo;
    if (await findPasskey(credential.id)) {
      return NextResponse.json({ error: 'This passkey is already registered' }, { status: 409 });
    }
    await addPasskey({
      id: credential.id,
      userId: user.id,
      name: body.name?.trim() || 'Passkey',
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[passkey registration] failed:', error);
    return NextResponse.json({ error: 'Passkey setup failed or expired' }, { status: 400 });
  }
}
