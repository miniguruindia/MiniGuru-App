"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const baseCategory_1 = __importDefault(require("../baseCategory"));
const logger_1 = __importDefault(require("../../logger"));
const error_1 = require("../../utils/error");
class ProjectCategoryService extends baseCategory_1.default {
    constructor() {
        super(prismaClient_1.default.projectCategory);
    }
    async getProjectsByCategory(categoryName) {
        try {
            logger_1.default.info(`Fetching projects for category name: ${categoryName}`);
            const category = await prismaClient_1.default.projectCategory.findUnique({
                where: { name: categoryName },
            });
            if (!category) {
                throw new error_1.NotFoundError("Category not found");
            }
            const projects = await prismaClient_1.default.project.findMany({
                where: { categoryId: category.id },
                include: {
                    category: true,
                },
            });
            if (projects.length === 0) {
                throw new error_1.NotFoundError("No projects found for the given category");
            }
            logger_1.default.info(`Fetched ${projects.length} projects for category Name: ${categoryName}`);
            return projects;
        }
        catch (error) {
            logger_1.default.error(`Error fetching projects for category ID: ${categoryName}: ${error.message}`);
            throw new error_1.ServiceError("Unable to fetch projects for category");
        }
    }
}
exports.default = ProjectCategoryService;
