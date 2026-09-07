import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/adminAuth';
import { deletePasskey, listPasskeysForUser } from '@/lib/passkeys';

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const passkeys = await listPasskeysForUser(user.id);
  return NextResponse.json({
    passkeys: passkeys.map(({ id, name, createdAt, lastUsedAt }: { id: string; name: string; createdAt: string; lastUsedAt?: string }) => ({ id, name, createdAt, lastUsedAt })),
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await request.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'Passkey ID is required' }, { status: 400 });
  await deletePasskey(user.id, id);
  return NextResponse.json({ ok: true });
}
