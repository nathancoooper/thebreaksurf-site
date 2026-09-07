'use client';

import { usePathname } from 'next/navigation';

// Pages with a full-screen hero that sits under the fixed navbar — no top padding needed.
const HERO_PATHS = ['/', '/environment', '/about', '/university'];

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const needsPad = !HERO_PATHS.includes(usePathname());
  return <main className={`flex-1 ${needsPad ? 'pt-[72px]' : ''}`}>{children}</main>;
}
