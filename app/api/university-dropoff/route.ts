import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UniversitySubmission } from '@/types';
import { getResend, FROM_EMAIL, REPLY_TO, universityDropoffAlertHtml } from '@/lib/resend';
import { saveSubmission } from '@/lib/universitySubmissions';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const studentName = formData.get('studentName');
  const studentEmail = formData.get('studentEmail');
  const garment = formData.get('garment');
  const placement = formData.get('placement');
  const colour = formData.get('colour');
  const note = formData.get('note');
  const photo = formData.get('photo');

  if (!studentName || !studentEmail || !garment || !placement || !colour) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let photoPath: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Photo too large' }, { status: 400 });
    }
    const ext = PHOTO_EXT[photo.type];
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported photo type' }, { status: 400 });
    }
    const dir = path.join(process.cwd(), 'public', 'images', 'uploads', 'university-photos');
    await fs.mkdir(dir, { recursive: true });
    const filename = `${id}${ext}`;
    await fs.writeFile(path.join(dir, filename), Buffer.from(await photo.arrayBuffer()));
    photoPath = `/images/uploads/university-photos/${filename}`;
  }

  const submission: UniversitySubmission = {
    id,
    studentName: String(studentName).trim().slice(0, 80),
    studentEmail: String(studentEmail).trim().slice(0, 120),
    garment: String(garment).trim().slice(0, 200),
    placement: String(placement).trim().slice(0, 80),
    colour: String(colour).trim().slice(0, 80),
    note: note ? String(note).trim().slice(0, 500) : undefined,
    photo: photoPath,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  await saveSubmission(submission);

  await (await getResend()).emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to: REPLY_TO,
    subject: `University drop-off — ${submission.studentName} (${submission.garment})`,
    html: universityDropoffAlertHtml(submission),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
