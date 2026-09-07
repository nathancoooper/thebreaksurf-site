import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import fs from 'node:fs';
import path from 'node:path';

const SESSION_COOKIE = 'tbs-session';
const UNPROTECTED = ['/admin/login', '/admin/setup'];

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(s));
    return !payload.pending2FA;
  } catch {
    return false;
  }
}

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

  // Auth gate for admin routes (login and setup pages are always accessible).
  // The admin service only ever receives admin.thebreaksurf.co.uk traffic
  // from nginx, but the gate stays so direct VPS access is safe too.
  if (pathname.startsWith('/admin') && !UNPROTECTED.includes(pathname)) {
    if (!await hasValidSession(request)) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Maintenance mode: redirect non-admin visitors to /construction unless
  // they have a valid admin session.
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/construction') && isMaintenanceOn()) {
    if (!await hasValidSession(request)) {
      return NextResponse.redirect(new URL('/construction', request.url));
    }
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  }

  // Public pages are cacheable at the edge. Cart/checkout result pages
  // and all admin routes are never cached.
  if (
    !pathname.startsWith('/admin')
    && !request.nextUrl.pathname.startsWith('/cart')
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
