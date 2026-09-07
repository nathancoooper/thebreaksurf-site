'use client';

import { useState } from 'react';
import Logo from './Logo';

export default function FooterLogo() {
  const [hovered, setHovered] = useState(false);
  return (
    <Logo
      style={{
        height: '1.75rem',
        width: 'auto',
        color: 'rgba(28,28,28,0.5)',
        transform: hovered ? 'rotate(0deg)' : 'rotate(-6deg)',
        transition: 'transform 0.3s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    />
  );
}
