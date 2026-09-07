import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
  const file = path.join(process.cwd(), 'data', 'events.json');
  const events = JSON.parse(fs.readFileSync(file, 'utf8'));
  return NextResponse.json(events);
}
