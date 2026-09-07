'use client';

import { useEffect } from 'react';

export default function HitTracker() {
  useEffect(() => {
    if (sessionStorage.getItem('tracked')) return;
    sessionStorage.setItem('tracked', '1');
    fetch('/api/stats', { method: 'POST' }).catch(() => {});
  }, []);

  return null;
}
