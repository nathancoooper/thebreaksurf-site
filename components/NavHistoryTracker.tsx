'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function NavHistoryTracker() {
  const pathname = usePathname();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevRef.current && prevRef.current !== pathname) {
      sessionStorage.setItem('tbs-prev-path', prevRef.current);
    }
    prevRef.current = pathname;
  }, [pathname]);

  return null;
}
