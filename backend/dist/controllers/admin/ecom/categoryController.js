"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProductCategory = exports.updateProductCategory = exports.getAllCategories = exports.getProductsByCategory = exports.createProductCategory = void 0;
const ecomCategory_1 = __importDefault(require("../../../services/ecom/ecomCategory"));
const error_1 = require("../../../utils/error");
const productCategoryService = new ecomCategory_1.default();
// Helper function to check if the user is an admin
const isAdmin = (userRole) => {
    return userRole === "ADMIN";
};
// Helper function to handle errors
const handleErrorResponse = (res, error) => {
    if (error instanceof error_1.NotFoundError) {
        return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
};
const createProductCategory = async (req, res) => {
    if (!isAdmin(req.user?.role)) {
        return res.status(403).json({ error: "Forbidden: Only admins can create categories." });
    }
    const { name, icon, imageUrl } = req.body;
    try {
        const category = await productCategoryService.create({ name, icon, imageUrl });
        res.status(201).json(category);
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.createProductCategory = createProductCategory;
const getProductsByCategory = async (req, res) => {
    const { categoryName } = req.params;
    try {
        const products = await productCategoryService.getProductsByCategory(categoryName);
        res.json(products);
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.getProductsByCategory = getProductsByCategory;
const getAllCategories = async (req, res) => {
    try {
        const categories = await productCategoryService.getAll();
        res.status(200).json(categories);
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.getAllCategories = getAllCategories;
const updateProductCategory = async (req, res) => {
    if (!isAdmin(req.user?.role)) {
        return res.status(403).json({ error: "Forbidden: Only admins can update categories." });
    }
    const { id } = req.params;
    const { name, icon, imageUrl } = req.body;
    try {
        const updatedCategory = await productCategoryService.update(id, { name, icon, imageUrl });
        res.status(200).json(updatedCategory);
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.updateProductCategory = updateProductCategory;
const deleteProductCategory = async (req, res) => {
    if (!isAdmin(req.user?.role)) {
        return res.status(403).json({ error: "Forbidden: Only admins can delete categories." });
    }
    const { id } = req.params;
    try {
        await productCategoryService.delete(id);
        res.status(204).send();
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.deleteProductCategory = deleteProductCategory;
