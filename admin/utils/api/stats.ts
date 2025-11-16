"use server"
import { apiClient } from "./apiClient"
import { ServiceError, ForbiddenError, NotFoundError } from "./error"

export const getStats = async () => {
  try {
    const response = await apiClient.get('/admin/stats');
    return response.data;
  } catch (error) {
    handleError(error);
  }
}

const handleError = (error): never => {
    if (error.response) {
      switch (error.response.status) {
        case 404:
          throw new NotFoundError('Stats not found');
        case 403:
          throw new ForbiddenError('Access is forbidden');
        default:
          throw new ServiceError('An unexpected error occurred');
      }
    }
    throw new ServiceError('An error occurred while processing the request');
  };
  