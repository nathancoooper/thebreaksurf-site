import { NextResponse } from 'next/server';
import { downloadFromR2, uploadToR2 } from '@/lib/r2';

const STATS_KEY = 'stats/counter.json';
const INITIAL_HITS = 2100;

interface StatsData {
  hits: number;
  daily: Record<string, number>;
}

async function readStats(): Promise<StatsData> {
  try {
    const result = await downloadFromR2(STATS_KEY);
    if (result) {
      const text = new TextDecoder().decode(result.content);
      return JSON.parse(text);
    }
  } catch {}
  return { hits: INITIAL_HITS, daily: {} };
}

async function writeStats(data: StatsData): Promise<void> {
  await uploadToR2(STATS_KEY, JSON.stringify(data), 'application/json');
}

export async function GET() {
  try {
    const data = await readStats();
    return NextResponse.json({ hits: data.hits, daily: data.daily });
  } catch {
    return NextResponse.json({ hits: INITIAL_HITS });
  }
}

export async function POST() {
  try {
    const data = await readStats();
    data.hits += 1;
    const today = new Date().toISOString().slice(0, 10);
    data.daily[today] = (data.daily[today] ?? 0) + 1;
    await writeStats(data);
    return NextResponse.json({ hits: data.hits });
  } catch {
    return NextResponse.json({ error: 'Failed to update stats' }, { status: 500 });
  }
}
