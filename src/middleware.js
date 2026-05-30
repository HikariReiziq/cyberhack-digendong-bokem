import { NextResponse } from 'next/server';
import { verifyJwt } from '@/utils/jwt';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Define protected paths
  const isProtectedRoute = pathname.startsWith('/dashboard') || 
                           pathname.startsWith('/digital-twin') || 
                           pathname.startsWith('/copilot') || 
                           pathname.startsWith('/settings');

  if (isProtectedRoute) {
    const token = request.cookies.get('token')?.value;
    const verifiedToken = token && await verifyJwt(token);
    
    if (!verifiedToken) {
      // Token is missing or invalid, redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('session', 'expired');
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
