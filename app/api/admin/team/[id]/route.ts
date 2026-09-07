import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { generateSecret, keyuri } from '@/lib/totp';
import { getSessionUser } from '@/lib/adminAuth';
import { getUserById, updateUser, deleteUser, type AdminAccount } from '@/lib/auth';

function publicShape(u: AdminAccount) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, permissions: u.permissions, emailAddresses: u.emailAddresses, hasTillPin: !!u.tillPinHash, createdAt: u.createdAt };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req);
  if (!me || me.role !== 'owner') return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { permissions?: string[]; emailAddresses?: string[]; newPassword?: string; resetTotp?: boolean; tillPin?: string; clearTillPin?: boolean };
  const patch: Partial<AdminAccount> = {};
  let totpReset: { qrDataUrl: string; totpSecret: string } | undefined;

  // Till PINs are the one field an owner may set on their own account —
  // they're a door key to the till, not an elevation of panel permissions.
  const tillPinOnly = (body.tillPin !== undefined || body.clearTillPin === true)
    && body.permissions === undefined && body.emailAddresses === undefined
    && body.newPassword === undefined && !body.resetTotp;
  if (target.role === 'owner' && !tillPinOnly) {
    return NextResponse.json({ error: 'The owner account can\'t be edited here' }, { status: 400 });
  }

  if (Array.isArray(body.permissions)) patch.permissions = body.permissions;
  if (Array.isArray(body.emailAddresses)) {
    const addresses = [...new Set(body.emailAddresses.map(address => address.trim().toLowerCase()).filter(Boolean))];
    if (addresses.some(address => !/^[^\s@]+@thebreaksurf\.co\.uk$/.test(address))) {
      return NextResponse.json({ error: 'Inbox addresses must use @thebreaksurf.co.uk' }, { status: 400 });
    }
    patch.emailAddresses = addresses;
  }

  if (body.newPassword) {
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    patch.passwordHash = await bcrypt.hash(body.newPassword, 12);
  }

  if (body.clearTillPin) {
    patch.tillPinHash = undefined;
  } else if (body.tillPin !== undefined) {
    if (!/^\d{4,8}$/.test(body.tillPin)) {
      return NextResponse.json({ error: 'Till PIN must be 4–8 digits' }, { status: 400 });
    }
    patch.tillPinHash = await bcrypt.hash(body.tillPin, 12);
  }

  if (body.resetTotp) {
    const totpSecret = generateSecret();
    patch.totpSecret = totpSecret;
    const uri = keyuri(target.email, 'TBS Admin', totpSecret);
    totpReset = { qrDataUrl: await QRCode.toDataURL(uri), totpSecret };
  }

  const updated = await updateUser(id, patch);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ account: publicShape(updated), ...(totpReset ? { totpReset } : {}) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req);
  if (!me || me.role !== 'owner') return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (target.role === 'owner') return NextResponse.json({ error: 'The owner account can\'t be deleted' }, { status: 400 });

  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
