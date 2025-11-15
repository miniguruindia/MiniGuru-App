"use server"
import axios, { InternalAxiosRequestConfig, AxiosHeaders } from 'axios';
import {  getAuthToken } from '@/utils/auth';
// import { NotFoundError, ServiceError, UnauthorizedError, ForbiddenError } from './error';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAuthToken();

  // Ensure headers exist and are properly typed
  if (!config.headers) {
    config.headers = {} as AxiosHeaders;
  }

  if (token) {
    // Use type assertion for compatibility
    (config.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`);
  }

  return config;
});