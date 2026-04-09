"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const error_1 = require("../../utils/error");
class ProjectService {
    constructor() {
        this.includeConditions = {
            category: {
                select: { name: true },
            },
            user: {
                select: { name: true },
            },
            comments: {
                select: {
                    content: true,
                    commentedBy: {
                        select: {
                            name: true,
                            id: true,
                        }
                    }
                }
            }
        };
    }
    async create(userId, projectData) {
        const { title, description, startDate, endDate, materials, categoryName, thumbnailPath, videoUrl, } = projectData;
        const category = await prismaClient_1.default.projectCategory.findUnique({
            where: { name: categoryName },
        });
        if (!category)
            throw new error_1.NotFoundError("Category not found");
        const enrichedMaterials = await this.addNameToMaterials(materials);
        return await prismaClient_1.default.project.create({
            data: {
                title,
                description,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                thumbnail: thumbnailPath,
                video: { url: videoUrl },
                materials: enrichedMaterials,
                userId,
                categoryId: category.id,
            },
        });
    }
    async update(userId, id, projectData) {
        const { title, description, startDate, endDate, materials, categoryName, thumbnailPath, videoUrl, } = projectData;
        let category;
        if (categoryName) {
            category = await prismaClient_1.default.projectCategory.findUnique({
                where: { name: categoryName },
            });
            if (!category)
                throw new error_1.NotFoundError("Category not found");
        }
        const enrichedMaterials = materials
            ? await this.addNameToMaterials(materials)
            : undefined;
        return await prismaClient_1.default.project.update({
            where: { id },
            data: {
                title,
                description,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                thumbnail: thumbnailPath,
                video: videoUrl ? { url: videoUrl } : undefined,
                materials: enrichedMaterials,
                categoryId: category?.id,
            },
        });
    }
    async getById(userId, id) {
        const project = await prismaClient_1.default.project.findUnique({
            where: { id },
            include: this.includeConditions,
        });
        if (!project)
            throw new error_1.NotFoundError("Project not found");
        return project;
    }
    async getAllForUser(userId) {
        return await prismaClient_1.default.project.findMany({
            where: { userId },
            include: this.includeConditions,
        });
    }
    async getAll(page, limit) {
        const projects = await prismaClient_1.default.project.findMany({
            skip: (page - 1) * limit,
            take: limit,
            include: this.includeConditions,
        });
        const totalProjects = await prismaClient_1.default.project.count();
        return { projects, totalProjects };
    }
    async addNameToMaterials(materials) {
        const productIds = materials.map((material) => material.productId);
        const products = await prismaClient_1.default.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
        });
        const productMap = new Map(products.map((product) => [product.id, product.name]));
        return materials.map((material) => ({
            productId: material.productId, // Use `productId` instead of `id`
            quantity: material.quantity,
            name: productMap.get(material.productId),
        }));
    }
    async deleteById(projectId) {
        await prismaClient_1.default.project.delete({
            where: { id: projectId },
        });
    }
}
exports.default = ProjectService;
