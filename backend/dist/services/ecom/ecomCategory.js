"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const baseCategory_1 = __importDefault(require("../baseCategory"));
const logger_1 = __importDefault(require("../../logger"));
const error_1 = require("../../utils/error");
class ProductCategoryService extends baseCategory_1.default {
    constructor() {
        super(prismaClient_1.default.productCategory);
    }
    async getProductsByCategory(categoryName) {
        try {
            logger_1.default.info(`Fetching products for category Name: ${categoryName}`);
            const category = await prismaClient_1.default.projectCategory.findUnique({
                where: { name: categoryName },
            });
            const products = await prismaClient_1.default.product.findMany({
                where: { categoryId: category?.id },
            });
            if (products.length === 0) {
                throw new error_1.NotFoundError("No products found for the given category");
            }
            logger_1.default.info(`Fetched ${products.length} products for category ID: ${categoryName}`);
            return products;
        }
        catch (error) {
            logger_1.default.error(`Error fetching products for category ID: ${categoryName}: ${error.message}`);
            throw new error_1.ServiceError("Unable to fetch products for category");
        }
    }
}
exports.default = ProductCategoryService;
