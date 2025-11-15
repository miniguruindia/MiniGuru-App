import { Request, Response } from "express";
import ProductCategoryService from "../../../services/ecom/ecomCategory";
import { NotFoundError } from "../../../utils/error";

const productCategoryService = new ProductCategoryService();

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

export const createProductCategory = async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden: Only admins can create categories." });
  }

  const { name, icon } = req.body;

  try {
    const category = await productCategoryService.create({ name, icon });
    res.status(201).json(category);
  } catch (error) {
    handleErrorResponse(res, error);
  }
};

export const getProductsByCategory = async (req: Request, res: Response) => {
  const { categoryName } = req.params;

  try {
    const products = await productCategoryService.getProductsByCategory(categoryName);
    res.json(products);
  } catch (error) {
    handleErrorResponse(res, error);
  }
};

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await productCategoryService.getAll();
    res.status(200).json(categories);
  } catch (error) {
    handleErrorResponse(res, error);
  }
};

export const updateProductCategory = async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden: Only admins can update categories." });
  }

  const { id } = req.params;
  const { name, icon } = req.body;

  try {
    const updatedCategory = await productCategoryService.update(id, { name, icon });
    res.status(200).json(updatedCategory);
  } catch (error) {
    handleErrorResponse(res, error);
  }
};

export const deleteProductCategory = async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden: Only admins can delete categories." });
  }

  const { id } = req.params;

  try {
    await productCategoryService.delete(id);
    res.status(204).send();
  } catch (error) {
    handleErrorResponse(res, error);
  }
};
