const PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

function Star({ fill, size, color }: { fill: 'empty' | 'half' | 'full'; size: number; color: string }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d={PATH} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {fill !== 'empty' && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: fill === 'half' ? '50%' : '100%' }}
        >
          <svg width={size} height={size} viewBox="0 0 24 24">
            <path d={PATH} fill={color} />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function StarRating({ rating, size = 16, color = '#D4862A' }: { rating: number; size?: number; color?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          fill={rating >= i ? 'full' : rating >= i - 0.5 ? 'half' : 'empty'}
          color={color}
        />
      ))}
    </div>
  );
}
