'use client';

import { useState } from 'react';
import Logo from '@/components/Logo';

const ORANGE = '#d97706';
const MUTED = 'rgba(28,28,28,0.35)';

export default function ConstructionPage() {
  const [logoHovered, setLogoHovered] = useState(false);
  const [emailHovered, setEmailHovered] = useState(false);

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: '#F2EDE3',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <Logo
        style={{
          height: '2rem',
          width: 'auto',
          color: logoHovered ? ORANGE : 'rgba(28,28,28,0.5)',
          transform: logoHovered ? 'rotate(0deg)' : 'rotate(-6deg)',
          transition: 'transform 0.3s ease, color 0.15s ease',
        }}
        onMouseEnter={() => setLogoHovered(true)}
        onMouseLeave={() => setLogoHovered(false)}
      />
      <p style={{ fontSize: '13px', color: 'rgba(28,28,28,0.5)', letterSpacing: '0.02em' }}>
        Something is coming.
      </p>
      <a
        href="mailto:nathan@thebreaksurf.co.uk"
        style={{
          fontSize: '12px',
          color: emailHovered ? ORANGE : MUTED,
          textDecoration: 'none',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={() => setEmailHovered(true)}
        onMouseLeave={() => setEmailHovered(false)}
      >
        nathan@thebreaksurf.co.uk
      </a>
    </main>
  );
}
