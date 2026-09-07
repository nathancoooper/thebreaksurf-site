import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import type { Event } from '@/types';

function pad(n: number) { return String(n).padStart(2, '0'); }

function toIcalDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const events: Event[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'events.json'), 'utf8'));
  const event = events.find(e => e.id === id);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const start = toIcalDate(event.date);
  // Default to 2-hour duration
  const end = toIcalDate(new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000).toISOString());

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Break Surf//Events//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@thebreaksurf.co.uk`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.name}`,
    `LOCATION:${event.location}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.id}.ics"`,
    },
  });
}
