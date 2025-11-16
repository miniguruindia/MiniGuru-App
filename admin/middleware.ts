// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuthGuard } from '@/utils/authGuard';

export async function middleware(request: NextRequest) {
  // Public routes that don't require authentication
  const publicPaths = ['/login', '/unauthorized', "/dashboard/login"];

  // Skip authentication for public paths
  if (publicPaths.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }


  return await adminAuthGuard(request) || NextResponse.next();
}

// Specify which routes to protect
export const config = {
  matcher: ['/users', '/users/:path*', '/', '/projects', '/projects/:path*','/orders', '/orders/:path*','/products', '/products/:path*','/categories', '/categories/:path*',],
}