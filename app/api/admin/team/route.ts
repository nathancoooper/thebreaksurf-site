import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { generateSecret, keyuri } from '@/lib/totp';
import { getSessionUser } from '@/lib/adminAuth';
import { listUsers, createUser, type AdminAccount } from '@/lib/auth';

function publicShape(u: AdminAccount) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, permissions: u.permissions, emailAddresses: u.emailAddresses, createdAt: u.createdAt };
}

export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || me.role !== 'owner') return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const users = await listUsers();
  return NextResponse.json({ accounts: users.map(publicShape) });
}

export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || me.role !== 'owner') return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { name, email, password, permissions } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const users = await listUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const totpSecret = generateSecret();
  const account: AdminAccount = {
    id: `member-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    email,
    passwordHash,
    totpSecret,
    role: 'member',
    permissions: Array.isArray(permissions) ? permissions : [],
    emailAddresses: [],
    createdAt: new Date().toISOString(),
  };
  await createUser(account);

  // Relayed to the teammate directly (no email-invite flow) — same TOTP
  // provisioning as the owner's own first-time setup.
  const uri = keyuri(account.email, 'TBS Admin', totpSecret);
  const qrDataUrl = await QRCode.toDataURL(uri);

  return NextResponse.json({ account: publicShape(account), qrDataUrl, totpSecret });
}
