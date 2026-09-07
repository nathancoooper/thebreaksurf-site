'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BackLink() {
  const [from, setFrom] = useState<{ href: string; label: string } | null>(null);

  useEffect(() => {
    const prev = sessionStorage.getItem('tbs-prev-path');
    if (!prev) return;
    setFrom(prev === '/' ? { href: '/', label: 'Home' } : { href: '/writing', label: 'Writing' });
  }, []);

  return (
    <Link
      href={from?.href ?? '/writing'}
      className="mb-8 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-charcoal/50 hover:text-terra transition-colors"
    >
      ← {from?.label ?? 'Writing'}
    </Link>
  );
}
