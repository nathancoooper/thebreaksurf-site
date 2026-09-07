function timeAgo(ms: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
}

export default function ErpFreshness({ fetchedAt }: { fetchedAt: number | null }) {
  if (fetchedAt == null) return null;
  return <p className="mt-0.5 text-sm text-gray-400">Updated {timeAgo(fetchedAt)} from ERPNext</p>;
}
