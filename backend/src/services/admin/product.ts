import prisma from '../../utils/prismaClient';
import { ServiceError } from '../../utils/error';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { handlePrismaKnownError } from '../../utils/error';
import logger from '../../logger';

// Service to create a product
export const createProductService = async ({ name, description, price, inventory, categoryName, images }) => {
    try {
        const category = await findCategoryByName(categoryName);

        const product = await prisma.product.create({
            data: {
                name,
                description,
                price,
                inventory,
                categoryId: category.id,
                images,
            },
        });

        return product;
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
            handlePrismaKnownError(error);
        }
        logger.error(`Error ${(error as Error).message}`)
        throw new ServiceError('Failed to create product');
    }
};

export const updateProductService = async (id,{  name, description, price, inventory, categoryName, images }) => {
    try {
        // Find the existing product
        const existingProduct = await prisma.product.findUnique({
            where: { id },
        });

        if (!existingProduct) {
            throw new Error('Product not found');
        }

        interface UpdateProductData {
            name?: string;
            description?: string;
            price?: number;  // Assuming price is a number (e.g., float)
            inventory?: number; // Assuming inventory is a number (e.g., integer)
            categoryId?: string; // Assuming categoryId is a string (could be a number based on your schema)
            images?: string[]; // Assuming images is an array of strings
        }
        
        const updateData:UpdateProductData = {};

        console.log(price)

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = price;
        if (inventory !== undefined) updateData.inventory = inventory;
        if (categoryName !== undefined) {
            const category = await findCategoryByName(categoryName);
            updateData.categoryId = category.id;
        }
        if (images.length!=0) updateData.images = images;

        // Update the product
        const updatedProduct = await prisma.product.update({
            where: { id },
            data: updateData,
        });

        return updatedProduct;
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
            handlePrismaKnownError(error);
        }
        logger.error(`Error ${(error as Error).message}`);
        throw new ServiceError('Failed to update product');
    }
};

  

// Service to delete a product
export const deleteProductService = async (id: string) => {
    try {
        // `findUniqueOrThrow` will automatically throw if the product does not exist
        await prisma.product.findUniqueOrThrow({
            where: { id },
        });

        await prisma.product.delete({
            where: { id },
        });
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
            handlePrismaKnownError(error);
        }
        logger.error(`Error ${(error as Error).message}`)
        throw new ServiceError(`Failed to delete product with ID: ${id}`);
    }
};

// Service to fetch all products
export const getProductsService = async () => {
    try {
        const products = await prisma.product.findMany({
            include: { category: true },
        });
        return products;
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
            handlePrismaKnownError(error);
        }
        logger.error(`Error ${(error as Error).message}`)
        throw new ServiceError('Failed to fetch products');
    }
};

// Service to fetch a product by ID
export const getProductByIdService = async (id: string) => {
    try {
        // `findUniqueOrThrow` will automatically throw if the product does not exist
        const product = await prisma.product.findUniqueOrThrow({
            where: { id },
            include: { category: true },
        });

        return product;
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
            handlePrismaKnownError(error);
        }
        logger.error(`Error ${(error as Error).message}`)
        throw new ServiceError(`Failed to fetch product with ID: ${id}`);
    }
};

// Helper to find category by name
const findCategoryByName = async (name: string) => {
    try {
        // `findUniqueOrThrow` will throw if the category does not exist
        const category = await prisma.productCategory.findUniqueOrThrow({
            where: { name },
        });

        return category;
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
            handlePrismaKnownError(error);
        }
        logger.error(`Error ${(error as Error).message}`)
        throw new ServiceError(`Failed to fetch category ${name}`);
    }
};
