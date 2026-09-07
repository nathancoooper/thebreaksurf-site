'use client';

import { useEffect, useState } from 'react';

export default function MaintenanceBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetch('/api/maintenance-status')
      .then(r => r.json())
      .then(data => setShow(!!data.show))
      .catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <div style={{
      backgroundColor: '#d97706',
      color: '#fff',
      textAlign: 'center',
      padding: '8px 16px',
      fontSize: '12px',
      fontWeight: 500,
      letterSpacing: '0.05em',
      position: 'sticky',
      top: 0,
      zIndex: 9999,
    }}>
      MAINTENANCE MODE ON — only you can see this
    </div>
  );
}
