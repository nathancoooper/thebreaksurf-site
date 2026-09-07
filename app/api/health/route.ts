import { NextResponse } from 'next/server';

// Cheap, unauthenticated ping used by the worker's cron keep-warm handler to
// boot the Next.js server. Avoids D1/R2/auth so it stays well under the free
// tier's ~10ms CPU budget once the isolate is warm. Never cached — a cached
// response here (especially a stale 404) would defeat the whole point.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}