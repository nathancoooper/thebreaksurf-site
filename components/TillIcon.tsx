// Isometric cash-register mark for the till. Hand-built SVG: three shaded
// faces per volume (top/left/right) give the 3D read without gradients,
// so it stays crisp at any size on the PIN screen.

export default function TillIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="15 28 112 108" className={className} aria-hidden="true">
      {/* ground shadow */}
      <ellipse cx="68" cy="122" rx="42" ry="9" fill="#000000" opacity="0.05" />

      {/* receipt slipping out of the top */}
      <polygon points="84.2,76 96.4,83 96.4,51 84.2,44" fill="#ffffff" stroke="#e5e7eb" strokeWidth="1" />
      <g stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round">
        <line x1="87" y1="55" x2="94" y2="59" />
        <line x1="87" y1="60" x2="94" y2="64" />
        <line x1="87" y1="65" x2="94" y2="69" />
      </g>

      {/* body */}
      <polygon points="25.4,74 77.3,104 77.3,128 25.4,98" fill="#d1d5db" />
      <polygon points="112,84 77.3,104 77.3,128 112,108" fill="#9ca3af" />
      <polygon points="60,54 112,84 77.3,104 25.4,74" fill="#e5e7eb" />

      {/* keypad, drawn flat then projected onto the top face */}
      <g transform="matrix(0.866 0.5 -0.866 0.5 60 54)">
        {[13, 21.5, 30].map(b =>
          [32, 41.5, 51].map(a => (
            <rect
              key={`${a}-${b}`}
              x={a}
              y={b}
              width="8"
              height="8"
              rx="2"
              fill={a === 51 && b === 30 ? '#c4622d' : '#4b5563'}
            />
          ))
        )}
      </g>

      {/* drawer handle on the front face (plane-y runs upward, hence the negative y) */}
      <g transform="matrix(0.866 0.5 0 -1 25.4 74)">
        <rect x="20" y="-18" width="20" height="3.5" rx="1.75" fill="#c4622d" />
      </g>

      {/* display panel */}
      <polygon points="49.6,52 70.4,64 70.4,78 49.6,66" fill="#9ca3af" />
      <polygon points="82.5,57 70.4,64 70.4,78 82.5,71" fill="#6b7280" />
      <polygon points="61.7,45 82.5,57 70.4,64 49.6,52" fill="#111827" />
    </svg>
  );
}
