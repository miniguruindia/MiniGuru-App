"use server"
import { apiClient } from './apiClient';
import { NotFoundError, ForbiddenError, ServiceError } from './error'; // Import custom error classes
import { Product, ProductCategory } from '@/types/product';

// Get all product categories
export const getAllProductCategories = async (): Promise<ProductCategory[]> => {
  try {
    const response = await apiClient.get('/products/categories/all');
    return response.data;
  } catch (error) {
    handleError(error);
  }
}
//get all products
export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const response = await apiClient.get('/products');
    return response.data;
  } catch (error) {
    handleError(error);
  }
}

// Get a product by ID
export const getProductById = async (productId: string): Promise<Product> => {
  try {
    const response = await apiClient.get(`/products/${productId}`);
    return response.data;
  } catch (error) {
    handleError(error);
  }
}

// Create a product category
export const createProductCategory = async (name: string, icon: string = "default"): Promise<ProductCategory> => {
  try {
    const response = await apiClient.post('/admin/product/category', { name, icon });
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

// Delete a product category
export const deleteProductCategory = async (categoryId: string): Promise<void> => {
  try {
    await apiClient.delete(`/admin/product/category/${categoryId}`);
    console.log(`Product category with ID ${categoryId} deleted successfully.`);
  } catch (error) {
    handleError(error);
  }
};

// Update a product category
export const updateProductCategory = async (categoryId: string, updates: Partial<ProductCategory>): Promise<ProductCategory> => {
  try {
    const response = await apiClient.put(`/admin/product/category/${categoryId}`, updates);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

// Create a product
export const createProduct = async (formData: FormData): Promise<Product> => {
  try {
    const response = await apiClient.post('/admin/product', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

// Update a product
export const updateProduct = async (productId: string, formData: FormData): Promise<Product> => {
  try {
    const response = await apiClient.put(`/admin/product/${productId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

// Delete a product
export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    await apiClient.delete(`/admin/product/${productId}`);
    console.log(`Product with ID ${productId} deleted successfully.`);
  } catch (error) {
    handleError(error);
  }
};

// Error handling utility
const handleError = (error): never => {
  if (error.response) {
    switch (error.response.status) {
      case 404:
        throw new NotFoundError(`Product not found`);
      case 403:
        throw new ForbiddenError(`Access is forbidden`);
      default:
        throw new ServiceError('An unexpected error occurred');
    }
  }
  throw new ServiceError('An error occurred while processing the request');
};
