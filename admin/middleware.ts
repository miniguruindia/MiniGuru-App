import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuthGuard } from '@/utils/authGuard';

export async function middleware(request: NextRequest) {
  const publicPaths = ['/login', '/unauthorized', '/forgot-password', '/reset-password'];
  
  if (publicPaths.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  
  return await adminAuthGuard(request) || NextResponse.next();
}

export const config = {
  matcher: [
    '/users',
    '/users/:path*',
    '/',
    '/projects',
    '/projects/:path*',
    '/orders',
    '/orders/:path*',
    '/products',
    '/products/:path*',
    '/categories',
    '/categories/:path*',
  ],
}
