import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuthGuard } from '@/utils/authGuard';

export async function middleware(request: NextRequest) {
  console.log('Middleware triggered for path:', request.nextUrl.pathname);
  
  const publicPaths = ['/login', '/unauthorized', '/forgot-password', '/reset-password'];
  
  if (publicPaths.includes(request.nextUrl.pathname)) {
    console.log('Public path, allowing access');
    return NextResponse.next();
  }
  
  console.log('Protected path, checking auth');
  const result = await adminAuthGuard(request);
  if (result) {
    console.log('Auth guard returned redirect:', result.url);
  } else {
    console.log('Auth guard passed, allowing access');
  }
  
  return result || NextResponse.next();
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
