import { NextRequest, NextResponse } from 'next/server';

// Protect /admin/* routes — require admin_session cookie
// Redirects to /admin/login if no session
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the admin login page and its API route
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  // Check for admin session cookie
  const sessionToken = request.cookies.get('ua_admin')?.value;

  if (!sessionToken) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session token exists — let the server actions validate it (requireAdminOrThrow)
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};