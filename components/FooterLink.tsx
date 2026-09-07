'use client';

import Link from 'next/link';
import { useState } from 'react';

const ORANGE = '#d97706';
const MUTED  = 'rgba(28,28,28,0.6)';

export default function FooterLink({ href, children, external }: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const style = {
    color: hovered ? ORANGE : MUTED,
    transition: 'color 0.15s ease',
    fontSize: '12px',
    textDecoration: 'none',
  };

  const events = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (external || href.startsWith('mailto:')) {
    return (
      <a href={href} style={style} {...events}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    );
  }

  return <Link href={href} style={style} {...events}>{children}</Link>;
}
