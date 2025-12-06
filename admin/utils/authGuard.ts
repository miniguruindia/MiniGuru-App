// middleware/authGuard.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateToken, decodeToken } from '@/utils/auth';

export async function adminAuthGuard(request: NextRequest) {
  // Get the token from cookies
  const token = request.cookies.get('auth_token')?.value;

  // If no token, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Validate token
  if (!validateToken(token)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Decode token and check user role
  try {
    const decoded = await decodeToken(token);
    
    // Check if user is an admin
    if (decoded.role !== 'ADMIN') {
      // Redirect to unauthorized page or login if not an admin
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // User is authenticated and is an admin
    return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // Token validation failed
    return NextResponse.redirect(new URL('/login', request.url));
  }
}