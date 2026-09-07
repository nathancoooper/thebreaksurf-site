import VisitorStatsWidget from './VisitorStatsWidget';
import { fetchUptimeData } from '@/lib/uptimeRobot';

const BAR_HIGH  = 'rgba(28,28,28,0.7)';
const BAR_LOW   = 'rgba(28,28,28,0.2)';
const BAR_DOWN  = 'rgba(180,40,40,0.5)';
const ICON_BG   = 'rgba(28,28,28,0.06)';
const ICON_COLOR = 'rgba(28,28,28,0.5)';

const DAYS = 12;

export default async function FooterStats() {
  const uptime = await fetchUptimeData(DAYS);
  const uptimeLabel = `${uptime.ratio % 1 === 0 ? uptime.ratio.toFixed(0) : uptime.ratio.toFixed(2)}%`;

  return (
    <div className="flex flex-row items-center gap-2">
      <VisitorStatsWidget />

      {/* Uptime */}
      <div className="stat-widget flex items-center gap-3 rounded-xl bg-transparent px-3 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: ICON_BG }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: ICON_COLOR }} aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div className="text-left">
          <p className="text-xs font-medium text-charcoal">Uptime</p>
          <p className="text-[10px] text-charcoal/40">last 30 days</p>
        </div>
        <div className="flex h-6 items-end gap-0.5">
          {uptime.dailyRatios.map((r, i) => (
            <div
              key={i}
              className="w-[3px] rounded-sm"
              style={{
                height: `${Math.max(r, 10)}%`,
                backgroundColor: r < 90 ? BAR_DOWN : r < 100 ? BAR_LOW : BAR_HIGH,
              }}
            />
          ))}
        </div>
        <p className="min-w-[32px] text-right text-sm font-medium text-charcoal">{uptimeLabel}</p>
      </div>
    </div>
  );
}
