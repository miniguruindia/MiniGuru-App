"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProjectCategory = exports.updateProjectCategory = exports.getAllProjectCategories = exports.getProjectsByCategory = exports.createProjectCategory = void 0;
const projectCategory_1 = __importDefault(require("../../services/project/projectCategory"));
const error_1 = require("../../utils/error");
const projectCategoryService = new projectCategory_1.default();
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
const createProjectCategory = async (req, res) => {
    if (!isAdmin(req.user?.role)) {
        return res.status(403).json({ error: "Forbidden: Only admins can create categories." });
    }
    const { name, icon, imageUrl } = req.body;
    try {
        const category = await projectCategoryService.create({ name, icon, imageUrl });
        res.status(201).json(category);
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.createProjectCategory = createProjectCategory;
const getProjectsByCategory = async (req, res) => {
    const { categoryName } = req.params;
    try {
        const projects = await projectCategoryService.getProjectsByCategory(categoryName);
        res.json(projects);
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.getProjectsByCategory = getProjectsByCategory;
const getAllProjectCategories = async (req, res) => {
    try {
        const categories = await projectCategoryService.getAll();
        res.status(200).json(categories);
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.getAllProjectCategories = getAllProjectCategories;
const updateProjectCategory = async (req, res) => {
    if (!isAdmin(req.user?.role)) {
        return res.status(403).json({ error: "Forbidden: Only admins can update categories." });
    }
    const { id } = req.params;
    const { name, icon, imageUrl } = req.body;
    try {
        const updatedCategory = await projectCategoryService.update(id, { name, icon, imageUrl });
        res.status(200).json(updatedCategory);
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.updateProjectCategory = updateProjectCategory;
const deleteProjectCategory = async (req, res) => {
    if (!isAdmin(req.user?.role)) {
        return res.status(403).json({ error: "Forbidden: Only admins can delete categories." });
    }
    const { id } = req.params;
    try {
        await projectCategoryService.delete(id);
        res.status(204).send();
    }
    catch (error) {
        handleErrorResponse(res, error);
    }
};
exports.deleteProjectCategory = deleteProjectCategory;
