import { getDb } from './db';
import { UniversitySubmission } from '@/types';

export async function saveSubmission(submission: UniversitySubmission): Promise<void> {
  const db = getDb();
  await db.prepare(
    'INSERT INTO university_submissions (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = ?, updated_at = datetime(\'now\')'
  )
    .bind(submission.id, JSON.stringify(submission), JSON.stringify(submission))
    .run();
}

export async function listSubmissions(): Promise<UniversitySubmission[]> {
  const db = getDb();
  const rows = await db.prepare('SELECT data FROM university_submissions ORDER BY rowid DESC')
    .all<{ data: string }>();
  return rows.results.map((r: { data: string }) => JSON.parse(r.data) as UniversitySubmission);
}

export async function updateSubmission(id: string, completed: boolean): Promise<UniversitySubmission | null> {
  const db = getDb();
  const row = await db.prepare('SELECT data FROM university_submissions WHERE id = ?')
    .bind(id)
    .first<{ data: string }>();
  if (!row) return null;
  const submission = JSON.parse(row.data) as UniversitySubmission;
  submission.completed = completed;
  await db.prepare('UPDATE university_submissions SET data = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(JSON.stringify(submission), id)
    .run();
  return submission;
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.prepare('DELETE FROM university_submissions WHERE id = ?')
    .bind(id)
    .run();
  return result.meta.changes > 0;
}
