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

export const updateDispatch = async (
  orderId: string,
  data: {
    fulfillmentStatus: string;
    courierName: string;
    trackingNumber: string;
    estimatedDelivery?: string;
  }
): Promise<Order> => {
  try {
    const response = await apiClient.patch(`/admin/orders/${orderId}/dispatch`, data);
    return response.data;
  } catch (error) {
    handleError(error);
  }
}

const handleError = (error): never => {
  if (error.response) {
    switch (error.response.status) {
      case 404: throw new NotFoundError('Order not found');
      case 403: throw new ForbiddenError('Access is forbidden');
      default: throw new ServiceError('An unexpected error occurred');
    }
  }
  throw new ServiceError('An error occurred while processing the request');
};
