import { NextRequest, NextResponse } from 'next/server';
import { validateToken, decodeToken } from '@/utils/auth';

export async function adminAuthGuard(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!validateToken(token)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const decoded = await decodeToken(token);
    
    if (decoded.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    return null;
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
