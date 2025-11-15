import prisma from '../../utils/prismaClient';
import logger from '../../logger';
import { Prisma } from '@prisma/client';
import { NotFoundError, ServiceError } from '../../utils/error';
import { getUserWallet, deductWalletBalance } from './wallet';

export interface CreateOrderInput {
    userId: string;
    products: { id: string; quantity: number }[];
    deliveryAddress: string;
}

// Error handling utility to log and throw specific errors
const handleError = (error: unknown, context: string): never => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        // Record not found error
        logger.warn(`${context}: Record not found.`);
        throw new NotFoundError('Record not found.');
    }
    logger.error(`${context}: ${(error as Error).message}`);
    throw error;
};

export const createOrder = async (input: CreateOrderInput) => {
    const { userId, products, deliveryAddress } = input;

    if (!Array.isArray(products) || products.length === 0) {
        throw new ServiceError('Products array is required and must contain at least one item.');
    }

    try {
        const productIds = products.map(product => product.id);
        const dbProducts = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        if (dbProducts.length !== productIds.length) {
            throw new NotFoundError('Some products were not found.');
        }

        // Map the products from the database for quick access
        const productMap = new Map(dbProducts.map(product => [product.id, product]));

        let totalAmount = 0;
        const orderProducts: { productId: string; quantity: number; }[] = [];

        products.forEach(product => {
            const dbProduct = productMap.get(product.id);
            if (!dbProduct) {
                throw new NotFoundError(`Product with ID ${product.id} not found`);
            }
            if (dbProduct.inventory < product.quantity) {
                throw new ServiceError(`Insufficient inventory for product ID ${product.id}`);
            }
            totalAmount += dbProduct.price * product.quantity;
            orderProducts.push({
                productId: product.id,
                quantity: product.quantity,
            });
        });

        // Deduct wallet balance
        const wallet = await getUserWallet(userId);
        if (wallet!.balance < totalAmount) {
            throw new ServiceError('Insufficient wallet balance.');
        }

        // Deduct the wallet balance
        const transaction = await deductWalletBalance(userId, totalAmount);

        // Create the order with embedded products
        const order = await prisma.order.create({
            data: {
                userId,
                products: orderProducts,  // Embedded products passed directly
                totalAmount,
                paymentStatus: 'COMPLETED',
                transactionId: transaction!.id,
                deliveryAddress,
            },
        });

        // Update product inventory after the order is created
        for (const product of products) {
            await prisma.product.update({
                where: { id: product.id },
                data: { inventory: { decrement: product.quantity } }
            });
        }

        logger.info(`Order created successfully for user: ${userId}, order ID: ${order.id}`);
        return order;

    } catch (error) {
        handleError(error, 'Error creating order');
    }
};

export const getOrderById = async (userId: string, orderId: string) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include:{
                transaction:true
            }
        });

        if (!order) {
            throw new NotFoundError(`Order with ID ${orderId} not found.`);
        }

        if (order.userId !== userId) {
            throw new ServiceError('Forbidden: You do not have access to this order.');
        }

        return order;
    } catch (error) {
        handleError(error, 'Error fetching order by ID');
    }
};

export const getUserOrders = async (userId: string) => {
    try {
        const orders = await prisma.order.findMany({
            where: { userId },
            include:{
                transaction:true
            }
        });

        return orders;
    } catch (error) {
        handleError(error, `Error fetching orders for user ${userId}`);
    }
};

export const getAllOrders = async () => {
    try {
        const orders = await prisma.order.findMany({
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
                transaction: true,
            },
        });

        if (orders.length === 0) {
            logger.info('No orders found.');
        }

        return orders;
    } catch (error) {
        handleError(error, 'Error fetching all orders for admin');
    }
};
