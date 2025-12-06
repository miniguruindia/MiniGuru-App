import axios from 'axios';
import { UnauthorizedError } from './error';
import { setAuthCookie } from '../auth';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

let accessToken = '';
let refreshToken = '';

// ✅ Configure axios defaults for CORS
const apiClient = axios.create({
  baseURL: baseURL,
  withCredentials: true, // Critical for CORS with credentials
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log('🔵 API Request:', {
      url: config.url,
      method: config.method,
      baseURL: config.baseURL,
    });
    return config;
  },
  (error) => {
    console.error('🔴 Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log('🟢 API Response:', {
      url: response.config.url,
      status: response.status,
    });
    return response;
  },
  (error) => {
    console.error('🔴 API Error:', {
      url: error.config?.url,
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    return Promise.reject(error);
  }
);

export const login = async (email: string, password: string): Promise<void> => {
  try {
    console.log('🔐 Attempting login for:', email);
    console.log('🌐 API Base URL:', baseURL);
    
    const response = await apiClient.post('/auth/login', { 
      email, 
      password 
    });
    
    console.log('✅ Login successful:', response.data);
    
    accessToken = response.data.accessToken;
    refreshToken = response.data.refreshToken;
    await setAuthCookie(accessToken);
    
  } catch (error: any) {
    console.error('❌ Login error:', error);
    
    // Handle different error types
    if (error.code === 'ERR_NETWORK') {
      console.error('Network Error - Possible CORS issue or backend not reachable');
      throw new Error('Cannot connect to server. Please check your connection.');
    }
    
    if (error.response) {
      // Server responded with error
      const status = error.response.status;
      const message = error.response.data?.message || 'Login failed';
      
      console.error(`Server error ${status}:`, message);
      
      if (status === 401) {
        throw new UnauthorizedError('Invalid email or password');
      } else if (status === 500) {
        throw new Error('Server error. Please try again later.');
      }
      
      throw new Error(message);
    }
    
    // Network or other error
    throw new Error('Unable to connect to server. Please try again.');
  }
};

export const refreshAccessToken = async (): Promise<void> => {
  try {
    console.log('🔄 Refreshing access token...');
    
    const response = await apiClient.post('/auth/refresh-token', { 
      refreshToken 
    });
    
    console.log('✅ Token refreshed successfully');
    
    accessToken = response.data.accessToken;
    await setAuthCookie(accessToken);
    
  } catch (error: any) {
    console.error('❌ Token refresh error:', error);
    
    if (error.response?.status === 401) {
      throw new UnauthorizedError('Session expired. Please login again.');
    }
    
    throw new UnauthorizedError('Failed to refresh token');
  }
};

export const getAccessToken = (): string => accessToken;