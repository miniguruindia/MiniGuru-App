"use server"
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

// Define the type for JWT payload
interface JwtPayload {
  role: 'ADMIN' | 'USER';
  userId: string;
  exp?: number;  // Optional expiration time in seconds
}

// Cookie and JWT constants
const TOKEN_COOKIE_NAME = 'auth_token';
const COOKIE_EXPIRATION_TIME = 60 * 60; // 1 hour expiration in seconds


// Function to set the authentication cookie
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,       // Prevents access to cookie via JavaScript
    secure: process.env.NODE_ENV === 'production',  // Only over HTTPS in production
    sameSite: 'strict',   // Prevents CSRF attacks
    maxAge: COOKIE_EXPIRATION_TIME,  // 1 hour expiration
    path: '/',            // Accessible from the entire site
  });
}

// Function to get the authentication token from the cookie
export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(TOKEN_COOKIE_NAME);
  return cookie?.value || null;
}

// Function to clear the authentication cookie
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
}

// Function to decode the JWT token (without verifying signature)
export async function  decodeToken(token: string) : Promise<JwtPayload> {
  try {
    // Decode without verifying signature
    const decoded = jwt.decode(token) as JwtPayload;

    if (!decoded) {
      return null; // Return null if decoding fails
    }

    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null; // Return null if any error occurs during decoding
  }
}

// Function to check if the token is expired
export async function isTokenExpired(expirationTime: number) {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  return expirationTime < currentTime; // Check if expiration time has passed
}


export async function checkAdminAuth(): Promise<JwtPayload> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('No authentication token');
  }

  // Decode the token to check the role and expiration (no signature validation here)
  const decoded = await decodeToken(token);

  if (!decoded) {
    throw new Error('Invalid token');
  }

  // Check if the token is expired
  if (decoded.exp && isTokenExpired(decoded.exp)) {
    throw new Error('Token has expired');
  }

  // Check if the user has the required 'ADMIN' role
  if (decoded.role !== 'ADMIN') {
    throw new Error('Unauthorized: Admin access required');
  }

  return decoded;
}


export async function validateToken(token: string): Promise<boolean> {
  const decoded = await decodeToken(token);

  if (!decoded) {
    return false; // Invalid token if decoding fails
  }

  // Check if the token is expired
  if (decoded.exp && isTokenExpired(decoded.exp)) {
    return false; // Token is expired
  }

  // Check if the user has the required 'ADMIN' role
  if (decoded.role !== 'ADMIN') {
    return false; // Unauthorized if role is not 'ADMIN'
  }

  return true; // Token is valid
}

