import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromRequest, unauthorised } from '@/lib/adminAuth';
import { readData, writeData } from '@/lib/dataCache';
import { listMailContacts } from '@/lib/mailContacts';

export interface Person {
  id: string;
  name: string;
  role: string;
  email: string;
  createdAt: string;
}

// People = the `people` table (manually curated) aggregated with email
// contacts, deduped by email. Contact-originated entries are editable only
// via the email contact store, so they're surfaced read-only here.
export interface PersonRow extends Person {
  source: 'person' | 'contact';
}

export async function GET(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();

  const [people, contacts] = await Promise.all([
    readData<Person>('people').catch(() => [] as Person[]),
    listMailContacts().catch(() => []),
  ]);

  const byEmail = new Map<string, PersonRow>();
  for (const p of people) {
    const key = (p.email || '').toLowerCase();
    byEmail.set(key || p.id, { ...p, source: 'person' });
  }
  for (const c of contacts) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
    const key = (c.email || '').toLowerCase();
    if (!key) continue;
    const existing = byEmail.get(key);
    if (existing && existing.source === 'person') continue; // manual entry wins
    byEmail.set(key, {
      id: c.id,
      name: name || c.email,
      role: c.relationship ? c.relationship[0].toUpperCase() + c.relationship.slice(1) : 'Contact',
      email: c.email,
      createdAt: c.createdAt,
      source: 'contact',
    });
  }

  const rows = [...byEmail.values()];
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!await requireAdminFromRequest(req)) return unauthorised();
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const person: Person = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: body.name.trim(),
    role: body.role ?? 'Other',
    email: body.email?.trim() ?? '',
    createdAt: new Date().toISOString(),
  };
  await writeData('people', person);
  return NextResponse.json(person, { status: 201 });
}