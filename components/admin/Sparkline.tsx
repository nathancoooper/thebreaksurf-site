interface Props {
  data: number[];
  min: number;
  max: number;
  color?: string;
  height?: number;
}

export default function Sparkline({ data, min, max, color = '#9ca3af', height = 40 }: Props) {
  const width = 200;

  if (data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center text-[11px] text-gray-300">
        No data yet
      </div>
    );
  }

  const range = max - min || 1;
  const toXY = (v: number, i: number): [number, number] => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((Math.min(max, Math.max(min, v)) - min) / range) * height;
    return [x, y];
  };

  const linePoints = data.map((v, i) => toXY(v, i).join(',')).join(' ');
  const [firstX] = toXY(data[0], 0);
  const [lastX] = toXY(data[data.length - 1], data.length - 1);
  const areaPoints = `${firstX},${height} ${linePoints} ${lastX},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polygon points={areaPoints} fill={color} fillOpacity="0.15" stroke="none" />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
