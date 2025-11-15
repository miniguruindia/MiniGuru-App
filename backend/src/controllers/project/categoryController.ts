import { Request, Response } from "express";
import ProjectCategoryService from "../../services/project/projectCategory";
import { NotFoundError } from "../../utils/error";

const projectCategoryService = new ProjectCategoryService();

// Helper function to check if the user is an admin
const isAdmin = (userRole: string | undefined): boolean => {
  return userRole === "ADMIN";
};

// Helper function to handle errors
const handleErrorResponse = (res: Response, error: unknown) => {
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  return res.status(500).json({ error: (error as Error).message });
};

export const createProjectCategory = async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden: Only admins can create categories." });
  }

  const { name, icon } = req.body;

  try {
    const category = await projectCategoryService.create({ name, icon });
    res.status(201).json(category);
  } catch (error) {
    handleErrorResponse(res, error);
  }
};

export const getProjectsByCategory = async (req: Request, res: Response) => {
  const { categoryName } = req.params;

  try {
    const projects = await projectCategoryService.getProjectsByCategory(categoryName);
    res.json(projects);
  } catch (error) {
    handleErrorResponse(res, error);
  }
};

export const getAllProjectCategories = async (req: Request, res: Response) => {
  try {
    const categories = await projectCategoryService.getAll();
    res.status(200).json(categories);
  } catch (error) {
    handleErrorResponse(res, error);
  }
};

export const updateProjectCategory = async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden: Only admins can update categories." });
  }

  const { id } = req.params;
  const { name, icon } = req.body;

  try {
    const updatedCategory = await projectCategoryService.update(id, { name, icon });
    res.status(200).json(updatedCategory);
  } catch (error) {
    handleErrorResponse(res, error);
  }
};

export const deleteProjectCategory = async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden: Only admins can delete categories." });
  }

  const { id } = req.params;

  try {
    await projectCategoryService.delete(id);
    res.status(204).send();
  } catch (error) {
    handleErrorResponse(res, error);
  }
};
