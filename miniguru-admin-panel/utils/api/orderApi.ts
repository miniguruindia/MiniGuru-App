"use server"
import { Order } from "@/types/order";
import { apiClient } from "@/utils/api/apiClient";
import { NotFoundError, ForbiddenError, ServiceError } from './error'; 

export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const response = await apiClient.get('/admin/orders');
    return response.data;
  } catch (error) {
    handleError(error);
  }
}

const handleError = (error): never => {
    if (error.response) {
      switch (error.response.status) {
        case 404:
          throw new NotFoundError('Project not found');
        case 403:
          throw new ForbiddenError('Access is forbidden');
        default:
          throw new ServiceError('An unexpected error occurred');
      }
    }
    throw new ServiceError('An error occurred while processing the request');
  };
  