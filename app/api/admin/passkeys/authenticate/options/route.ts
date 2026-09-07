import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { passkeyRelyingParty } from '@/lib/passkeys';
import { signSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { rpID } = passkeyRelyingParty(request);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  const state = await signSession({ purpose: 'passkey-authentication', challenge: options.challenge }, '5m');
  return NextResponse.json({ options, state });
}
