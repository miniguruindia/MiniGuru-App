// middleware/authGuard.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateToken, decodeToken } from '@/utils/auth';

export async function adminAuthGuard(request: NextRequest) {
  console.log('AuthGuard: Checking authentication');
  
  // Get the token from cookies
  const token = request.cookies.get('auth_token')?.value;
  console.log('AuthGuard: Token present?', !!token);

  // If no token, redirect to login
  if (!token) {
    console.log('AuthGuard: No token, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Validate token
  console.log('AuthGuard: Validating token');
  if (!validateToken(token)) {
    console.log('AuthGuard: Token invalid, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Decode token and check user role
  try {
    console.log('AuthGuard: Decoding token');
    const decoded = await decodeToken(token);
    console.log('AuthGuard: Decoded role:', decoded.role);
    
    // Check if user is an admin
    if (decoded.role !== 'ADMIN') {
      console.log('AuthGuard: User not admin, redirecting to unauthorized');
      // Redirect to unauthorized page or login if not an admin
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    console.log('AuthGuard: User is admin, allowing access');
    // User is authenticated and is an admin
    return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.log('AuthGuard: Error decoding token:', error);
    // Token validation failed
    return NextResponse.redirect(new URL('/login', request.url));
  }
}