import axios from 'axios';
import { UnauthorizedError } from './error';
import { setAuthCookie } from '../auth';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

let accessToken = '';
let refreshToken = '';

export const login = async (email: string, password: string): Promise<void> => {
  try {
    const response = await axios.post(baseURL + '/auth/login', { email, password });
    accessToken = response.data.accessToken;
    refreshToken = response.data.refreshToken;
    await setAuthCookie(accessToken);
  } catch (error) {
    console.error('Login error:', error);
    throw new UnauthorizedError('Invalid credentials');
  }
};

export const refreshAccessToken = async (): Promise<void> => {
  try {
    const response = await axios.post(baseURL + '/auth/refresh-token', { refreshToken });
    accessToken = response.data.accessToken;
    await setAuthCookie(accessToken);
  } catch (error) {
    console.error('Token refresh error:', error);
    throw new UnauthorizedError('Failed to refresh token');
  }
};

export const getAccessToken = (): string => accessToken;
