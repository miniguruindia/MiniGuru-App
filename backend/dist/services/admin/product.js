"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductByIdService = exports.getProductsService = exports.deleteProductService = exports.updateProductService = exports.createProductService = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const error_1 = require("../../utils/error");
const library_1 = require("@prisma/client/runtime/library");
const error_2 = require("../../utils/error");
const logger_1 = __importDefault(require("../../logger"));
// Service to create a product
const createProductService = async ({ name, description, brand, size, howToUse, price, inventory, categoryName, images }) => {
    try {
        const category = await findCategoryByName(categoryName);
        const product = await prismaClient_1.default.product.create({
            data: {
                name,
                description,
                ...(brand && { brand }),
                ...(size && { size }),
                ...(howToUse && { howToUse }),
                price,
                inventory,
                categoryId: category.id,
                images,
            },
        });
        return product;
    }
    catch (error) {
        if (error instanceof library_1.PrismaClientKnownRequestError) {
            (0, error_2.handlePrismaKnownError)(error);
        }
        logger_1.default.error(`Error ${error.message}`);
        throw new error_1.ServiceError('Failed to create product');
    }
};
exports.createProductService = createProductService;
const updateProductService = async (id, { name, description, brand, size, howToUse, price, inventory, categoryName, images }) => {
    try {
        // Find the existing product
        const existingProduct = await prismaClient_1.default.product.findUnique({
            where: { id },
        });
        if (!existingProduct) {
            throw new Error('Product not found');
        }
        const updateData = {};
        console.log(price);
        if (name !== undefined)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        if (price !== undefined)
            updateData.price = price;
        if (inventory !== undefined)
            updateData.inventory = inventory;
        if (categoryName !== undefined) {
            const category = await findCategoryByName(categoryName);
            updateData.categoryId = category.id;
        }
        if (images.length != 0)
            updateData.images = images;
        // Update the product
        const updatedProduct = await prismaClient_1.default.product.update({
            where: { id },
            data: updateData,
        });
        return updatedProduct;
    }
    catch (error) {
        if (error instanceof library_1.PrismaClientKnownRequestError) {
            (0, error_2.handlePrismaKnownError)(error);
        }
        logger_1.default.error(`Error ${error.message}`);
        throw new error_1.ServiceError('Failed to update product');
    }
};
exports.updateProductService = updateProductService;
// Service to delete a product
const deleteProductService = async (id) => {
    try {
        // `findUniqueOrThrow` will automatically throw if the product does not exist
        await prismaClient_1.default.product.findUniqueOrThrow({
            where: { id },
        });
        await prismaClient_1.default.product.delete({
            where: { id },
        });
    }
    catch (error) {
        if (error instanceof library_1.PrismaClientKnownRequestError) {
            (0, error_2.handlePrismaKnownError)(error);
        }
        logger_1.default.error(`Error ${error.message}`);
        throw new error_1.ServiceError(`Failed to delete product with ID: ${id}`);
    }
};
exports.deleteProductService = deleteProductService;
// Service to fetch all products
const getProductsService = async () => {
    try {
        const products = await prismaClient_1.default.product.findMany({
            include: { category: true },
        });
        return products;
    }
    catch (error) {
        if (error instanceof library_1.PrismaClientKnownRequestError) {
            (0, error_2.handlePrismaKnownError)(error);
        }
        logger_1.default.error(`Error ${error.message}`);
        throw new error_1.ServiceError('Failed to fetch products');
    }
};
exports.getProductsService = getProductsService;
// Service to fetch a product by ID
const getProductByIdService = async (id) => {
    try {
        // `findUniqueOrThrow` will automatically throw if the product does not exist
        const product = await prismaClient_1.default.product.findUniqueOrThrow({
            where: { id },
            include: { category: true },
        });
        return product;
    }
    catch (error) {
        if (error instanceof library_1.PrismaClientKnownRequestError) {
            (0, error_2.handlePrismaKnownError)(error);
        }
        logger_1.default.error(`Error ${error.message}`);
        throw new error_1.ServiceError(`Failed to fetch product with ID: ${id}`);
    }
};
exports.getProductByIdService = getProductByIdService;
// Helper to find category by name
const findCategoryByName = async (name) => {
    try {
        // `findUniqueOrThrow` will throw if the category does not exist
        const category = await prismaClient_1.default.productCategory.findUniqueOrThrow({
            where: { name },
        });
        return category;
    }
    catch (error) {
        if (error instanceof library_1.PrismaClientKnownRequestError) {
            (0, error_2.handlePrismaKnownError)(error);
        }
        logger_1.default.error(`Error ${error.message}`);
        throw new error_1.ServiceError(`Failed to fetch category ${name}`);
    }
};
