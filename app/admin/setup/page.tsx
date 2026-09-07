'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Setup is handled by the shared login screen on both admin surfaces.
export default function SetupPage() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const loginPath = pathname.startsWith('/admin')
      ? '/admin/login'
      : pathname.startsWith('/finance')
        ? '/finance/login'
        : pathname.startsWith('/email')
          ? '/email/login'
          : '/login';
    router.replace(loginPath);
  }, [pathname, router]);
  return null;
}
