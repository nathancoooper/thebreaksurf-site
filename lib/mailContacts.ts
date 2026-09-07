import { getDb } from './db';

export type ContactRelationship = 'client' | 'supplier' | 'colleague' | 'partner' | 'artist' | 'friend' | 'other' | '';

export interface ContactSignificantDate {
  id: string;
  label: string;
  date: string;
}

export interface MailContact {
  id: string;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  relationship: ContactRelationship;
  company: string;
  email: string;
  phone: string;
  website: string;
  birthday: string;
  significantDates: ContactSignificantDate[];
}

export type MailContactInput = Omit<MailContact, 'id' | 'createdAt' | 'updatedAt'>;

function cleanInput(input: MailContactInput): MailContactInput {
  const clean = (value: unknown, maximum: number) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
  const relationship = ['client', 'supplier', 'colleague', 'partner', 'artist', 'friend', 'other'].includes(input.relationship)
    ? input.relationship
    : '';
  return {
    firstName: clean(input.firstName, 100),
    lastName: clean(input.lastName, 100),
    relationship: relationship as ContactRelationship,
    company: clean(input.company, 160),
    email: clean(input.email, 254).toLowerCase(),
    phone: clean(input.phone, 80),
    website: clean(input.website, 500),
    birthday: clean(input.birthday, 10),
    significantDates: (Array.isArray(input.significantDates) ? input.significantDates : []).slice(0, 30).map(item => ({
      id: clean(item.id, 100) || crypto.randomUUID(),
      label: clean(item.label, 120),
      date: clean(item.date, 10),
    })).filter(item => item.label || item.date),
  };
}

export async function listMailContacts() {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM email_contacts').all<{ data: string }>();
  const contacts = rows.results.map((r: { data: string }) => JSON.parse(r.data) as MailContact);
  return contacts.sort((a: MailContact, b: MailContact) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
  );
}

export async function createMailContact(input: MailContactInput) {
  const now = new Date().toISOString();
  const contact: MailContact = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...cleanInput(input) };
  const db = getDb();
  await db.prepare('INSERT INTO email_contacts (id, data) VALUES (?, ?)')
    .bind(contact.id, JSON.stringify(contact))
    .run();
  return contact;
}

export async function updateMailContact(id: string, input: MailContactInput) {
  const db = getDb();
  const row = await db.prepare('SELECT data FROM email_contacts WHERE id = ?')
    .bind(id)
    .first<{ data: string }>();
  if (!row) return null;
  const existing = JSON.parse(row.data) as MailContact;
  const updated = { ...existing, ...cleanInput(input), updatedAt: new Date().toISOString() };
  await db.prepare('UPDATE email_contacts SET data = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(JSON.stringify(updated), id)
    .run();
  return updated;
}

export async function deleteMailContact(id: string) {
  const db = getDb();
  const result = await db.prepare('DELETE FROM email_contacts WHERE id = ?')
    .bind(id)
    .run();
  return result.meta.changes > 0;
}
