import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server';
import { findPasskey, passkeyRelyingParty, storedPasskeyCredential, updatePasskeyUsage } from '@/lib/passkeys';
import { getUserById, setSessionCookie, signSession, verifySession } from '@/lib/auth';
import { recordLoginAttempt } from '@/lib/loginAudit';

export async function POST(request: NextRequest) {
  const body = await request.json() as { response?: AuthenticationResponseJSON; state?: string };
  if (!body.response || !body.state) return NextResponse.json({ error: 'Invalid passkey response' }, { status: 400 });
  const passkey = await findPasskey(body.response.id);
  const user = passkey ? await getUserById(passkey.userId) : null;
  if (!passkey || !user) return NextResponse.json({ error: 'Passkey is not recognised' }, { status: 401 });

  try {
    const state = await verifySession(body.state);
    if (state.purpose !== 'passkey-authentication' || typeof state.challenge !== 'string') throw new Error('Invalid challenge');
    const { rpID, expectedOrigin } = passkeyRelyingParty(request);
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: state.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: storedPasskeyCredential(passkey),
      requireUserVerification: true,
    });
    if (!verification.verified) throw new Error('Verification failed');
    await updatePasskeyUsage(passkey.id, verification.authenticationInfo.newCounter);
    await recordLoginAttempt(request, { userId: user.id, email: user.email, outcome: 'success' })
      .catch(error => console.error('[login audit] failed:', error));
    const token = await signSession({ sub: user.id }, '7d');
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, token, 60 * 60 * 24 * 7);
    return response;
  } catch (error) {
    console.error('[passkey authentication] failed:', error);
    return NextResponse.json({ error: 'Passkey verification failed or expired' }, { status: 401 });
  }
}
