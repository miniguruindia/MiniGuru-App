"use server"
import { apiClient } from './apiClient';
import { User } from '@/types/users';
import { NotFoundError, ForbiddenError, ServiceError } from '@/utils/api/error'; // Import custom error classes

export const fetchUserDetails = async (userId: string): Promise<User> => {
  try {
    const response = await apiClient.get(`/admin/users/${userId}`);
    return response.data.user;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      } else if (error.response.status === 403) {
        throw new ForbiddenError(`Access to user ID ${userId} is forbidden`);
      }
    }
    throw new ServiceError(error);
  }
};

export const updateUserDetails = async (userId: string, updates: Partial<User>): Promise<User> => {
  try {
    const response = await apiClient.put(`/admin/users/${userId}`, updates);
    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      } else if (error.response.status === 403) {
        throw new ForbiddenError(`Access to user ID ${userId} is forbidden`);
      }
    }
    throw new ServiceError('An error occurred while updating user details');
  }
};

export const listUsers = async (): Promise<User[]> => {
  try {
    const response = await apiClient.get(`/admin/users/`);
    return response.data.data;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    throw new ServiceError(error);
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  try {
    await apiClient.delete(`/admin/users/${userId}`);
    console.log(`User with ID ${userId} has been deleted successfully.`);
  } catch (error) {
    console.log(error);
    if (error.response) {
      if (error.response.status === 404) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      } else if (error.response.status === 403) {
        throw new ForbiddenError(`Access to user ID ${userId} is forbidden`);
      }
    }
    throw new ServiceError('An error occurred while deleting the user');
  }
};
