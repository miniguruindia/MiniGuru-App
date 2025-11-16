
export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden access') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ServiceError extends Error {
  constructor(message = 'Service error') {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ApiError extends Error {
  status: number;
  errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

export const handleApiError = (error): ApiError => {
  if (error.response) {
    
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        if (data.message === 'Token expired') {
          return new ApiError('Session expired. Please log in again.', status, 'TOKEN_EXPIRED');
        }
        return new ApiError('Unauthorized access. Invalid credentials.', status, 'UNAUTHORIZED');
      
      case 403:
        return new ApiError('Access denied. Insufficient permissions.', status, 'FORBIDDEN');
      
      case 404:
        return new ApiError('Requested resource not found.', status, 'NOT_FOUND');
      
      case 500:
        return new ApiError('Internal server error. Please try again later.', status, 'SERVER_ERROR');
      
      default:
        return new ApiError(data.message || 'An unexpected error occurred', status, 'UNKNOWN_ERROR');
    }
  } else if (error.request) {
    return new ApiError('No response from server. Check your network connection.', 0, 'NETWORK_ERROR');
  } else {
    return new ApiError('Error setting up the request', 0, 'REQUEST_SETUP_ERROR');
  }
};
