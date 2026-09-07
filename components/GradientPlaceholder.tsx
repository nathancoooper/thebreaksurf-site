// Deterministic per-seed placeholder for cover images that haven't been
// uploaded yet — a blurred colour gradient with a grain overlay so the
// admin list isn't just blank space.

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function GradientPlaceholder({ seed, className }: { seed: string; className?: string }) {
  const h = hashString(seed);
  const pick = (mod: number, salt: number) => (h >>> (salt * 4)) % mod;

  const hue1 = pick(360, 1);
  const hue2 = (hue1 + 90 + pick(120, 2)) % 360;
  const hue3 = (hue1 + 200 + pick(120, 3)) % 360;
  const uid = `ph${h}`;

  const blobs = [
    { cx: 15 + pick(40, 4), cy: 15 + pick(40, 5), r: 35 + pick(20, 6), hue: hue2 },
    { cx: 45 + pick(45, 7), cy: 55 + pick(40, 8), r: 30 + pick(25, 9), hue: hue3 },
  ];

  return (
    <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-base`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`hsl(${hue1} 65% 55%)`} />
          <stop offset="100%" stopColor={`hsl(${hue2} 60% 40%)`} />
        </linearGradient>
        <filter id={`${uid}-blur`}>
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={`${uid}-noise`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={h % 100} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0" />
        </filter>
      </defs>
      <rect width="100" height="100" fill={`url(#${uid}-base)`} />
      <g filter={`url(#${uid}-blur)`}>
        {blobs.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={`hsl(${b.hue} 70% 60%)`} opacity="0.55" />
        ))}
      </g>
      <rect width="100" height="100" filter={`url(#${uid}-noise)`} />
    </svg>
  );
}
