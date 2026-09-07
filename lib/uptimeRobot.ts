interface UptimeLog {
  type: number;   // 1=down, 2=up, 98=started, 99=paused
  datetime: number;
  duration: number;
}

export interface UptimeData {
  ratio: number;           // 0–100, over UptimeRobot's own configured window
  dailyRatios: number[];   // 0–100 per day, oldest first, `days` entries
}

export async function fetchUptimeData(days: number): Promise<UptimeData> {
  const apiKey = process.env.UPTIMEROBOT_API_KEY;
  const fallback: UptimeData = { ratio: 100, dailyRatios: Array(days).fill(100) };
  if (!apiKey) return fallback;

  try {
    const res = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: apiKey,
        custom_uptime_ratios: '30',
        logs: '1',
        logs_limit: '100',
      }).toString(),
      next: { revalidate: 3600 },
    });

    const data = await res.json();
    if (data.stat !== 'ok' || !data.monitors?.length) return fallback;

    const monitor = data.monitors[0];
    const ratio = parseFloat(monitor.custom_uptime_ratio ?? '100');
    const logs: UptimeLog[] = monitor.logs ?? [];

    // Compute per-day uptime ratio for the last `days` days
    const nowSec = Math.floor(Date.now() / 1000);
    const daySec = 86400;
    const dailyRatios = Array.from({ length: days }, (_, i) => {
      const dayEnd   = nowSec - (days - 1 - i) * daySec;
      const dayStart = dayEnd - daySec;
      let downtime = 0;
      for (const log of logs) {
        if (log.type !== 1) continue; // only count down events
        const logEnd = log.datetime + log.duration;
        const overlap = Math.min(logEnd, dayEnd) - Math.max(log.datetime, dayStart);
        if (overlap > 0) downtime += overlap;
      }
      return Math.round(Math.max(0, (daySec - downtime) / daySec) * 100);
    });

    return { ratio, dailyRatios };
  } catch {
    return fallback;
  }
}
