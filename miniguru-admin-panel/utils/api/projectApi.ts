"use server"
import { apiClient } from './apiClient';
import { NotFoundError, ForbiddenError, ServiceError } from './error'; // Import custom error classes
import { Project, ProjectCategory, GetAllProjectsResponse } from '@/types/project';

export const getAllProjects = async (page: number = 1): Promise<GetAllProjectsResponse> => {
  try {
    // Send the page parameter as a query parameter
    const response = await apiClient.get('/project/all', {
      params: {
        page,  // Sending the page number as a query parameter
      },
    });

    // Return both the projects and pagination data
    return {
      projects: response.data.projects,
      pagination: response.data.pagination,
    };
  } catch (error) {
    handleError(error);  // Handle any errors that occur
    throw error;  // Rethrow the error after handling
  }
};

// Get a project by ID
export const getProjectById = async (projectId: string): Promise<Project> => {
  try {
    const response = await apiClient.get(`/project/${projectId}`);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

// Create a project category
export const createProjectCategory = async (name: string, icon: string = "default"): Promise<ProjectCategory> => {
  try {
    const response = await apiClient.post('/admin/project/category', { name, icon });
    return response.data;
  } catch (error) {
    handleError(error);
  }
};


//get all project categories

export const getAllProjectCategories = async (): Promise<ProjectCategory[]> => {
  try {
    const response = await apiClient.get('/project/categories');
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

// Update a project category
export const updateProjectCategory = async (categoryId: string, updates: Partial<ProjectCategory>): Promise<ProjectCategory> => {
  try {
    const response = await apiClient.put(`/admin/project/category/${categoryId}`, updates);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

// Delete a project category
export const deleteProjectCategory = async (categoryId: string): Promise<void> => {
  try {
    await apiClient.delete(`/admin/project/category/${categoryId}`);
    console.log(`Project category with ID ${categoryId} deleted successfully.`);
  } catch (error) {
    handleError(error);
  }
};

export const deleteProjectById = async (projectId: string) => {
  try {
    await apiClient.delete(`/admin/project/${projectId}`);
  } catch (error) {
    handleError(error);
  }
};


// Error handling utility
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
  throw new ServiceError('An error occurred while processing the request'+error.message);
};
