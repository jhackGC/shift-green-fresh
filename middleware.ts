import { ADMIN_COOKIE_NAME, verifySessionCookie } from 'lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/admin/:path*']
};

export async function middleware(req: NextRequest) {
  // The login page is itself under /admin — don't gate the one page that has to stay reachable.
  if (req.nextUrl.pathname === '/admin/login') return NextResponse.next();

  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (await verifySessionCookie(cookie)) return NextResponse.next();

  const loginUrl = new URL('/admin/login', req.url);
  loginUrl.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
