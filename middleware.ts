import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const secret = new TextEncoder().encode(JWT_SECRET);
const JWT_COOKIE_NAME = 'homepage3_session';

/**
 * Next.js Middleware for route protection and onboarding checks
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get session token from cookies
  const token = request.cookies.get(JWT_COOKIE_NAME)?.value;

  // Verify token
  let session = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      session = payload;
    } catch (error) {
      // Invalid token - clear it
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete(JWT_COOKIE_NAME);
      return response;
    }
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!session) {
      // Not authenticated - redirect to home
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Check if user has admin or superuser role
    const role = session.role as string;
    if (role !== 'admin' && role !== 'superuser') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Allow access
    return NextResponse.next();
  }

  // For onboarding route, check if users exist
  // Note: This will be implemented once we have DB access in middleware
  // For now, we'll handle this in the page component

  return NextResponse.next();
}

/**
 * Configure which routes use this middleware
 */
export const config = {
  matcher: [
    '/admin/:path*',
    '/onboarding',
  ],
};
