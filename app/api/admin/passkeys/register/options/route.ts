import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions, type AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { getSessionUser } from '@/lib/adminAuth';
import { listPasskeysForUser, passkeyRelyingParty } from '@/lib/passkeys';
import { signSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { rpID } = passkeyRelyingParty(request);
  const existing = await listPasskeysForUser(user.id);
  const options = await generateRegistrationOptions({
    rpName: 'The Break Surf',
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: existing.map((item: { id: string; transports?: string[] }) => ({ id: item.id, transports: item.transports as AuthenticatorTransportFuture[] | undefined })),
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    },
  });
  const state = await signSession({ purpose: 'passkey-registration', sub: user.id, challenge: options.challenge }, '5m');
  return NextResponse.json({ options, state });
}
