import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

function isMaintenanceOn(): boolean {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'settings.json'), 'utf-8');
    return JSON.parse(raw).maintenanceMode === true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Maintenance mode: everyone except /construction gets redirected.
  // (Admin preview bypass lived in the old monorepo's proxy and was cut
  // with the admin panel — see TBS Admin repo.)
  if (!pathname.startsWith('/construction') && isMaintenanceOn()) {
    return NextResponse.redirect(new URL('/construction', request.url));
  }

  // Public pages are cacheable at Cloudflare's edge. Cart/checkout result
  // pages are never cached.
  if (
    !request.nextUrl.pathname.startsWith('/cart')
    && !request.nextUrl.pathname.startsWith('/success')
    && !request.nextUrl.pathname.startsWith('/cancel')
  ) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'public, s-maxage=3600');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|favicon\\.ico|images|luts).*)'],
};
