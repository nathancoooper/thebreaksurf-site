'use client';

import { useState } from 'react';

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

interface Props {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  color?: string;
}

export default function StarInput({ value, onChange, size = 28, color = '#D4862A' }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = display >= i ? 'full' : display >= i - 0.5 ? 'half' : 'empty';
        return (
          <div key={i} className="relative cursor-pointer" style={{ width: size, height: size }}>
            <Star fill={fill} size={size} color={color} />
            {/* left half = i - 0.5 */}
            <button
              type="button"
              aria-label={`${i - 0.5} stars`}
              className="absolute inset-y-0 left-0 w-1/2"
              onMouseEnter={() => setHovered(i - 0.5)}
              onClick={() => onChange(i - 0.5)}
            />
            {/* right half = i */}
            <button
              type="button"
              aria-label={`${i} stars`}
              className="absolute inset-y-0 right-0 w-1/2"
              onMouseEnter={() => setHovered(i)}
              onClick={() => onChange(i)}
            />
          </div>
        );
      })}
    </div>
  );
}
