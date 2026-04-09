"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllOrders = exports.getUserOrders = exports.getOrderById = exports.createOrder = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const logger_1 = __importDefault(require("../../logger"));
const client_1 = require("@prisma/client");
const error_1 = require("../../utils/error");
const wallet_1 = require("./wallet");
// Error handling utility to log and throw specific errors
const handleError = (error, context) => {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        // Record not found error
        logger_1.default.warn(`${context}: Record not found.`);
        throw new error_1.NotFoundError('Record not found.');
    }
    logger_1.default.error(`${context}: ${error.message}`);
    throw error;
};
const createOrder = async (input) => {
    const { userId, products, deliveryAddress } = input;
    if (!Array.isArray(products) || products.length === 0) {
        throw new error_1.ServiceError('Products array is required and must contain at least one item.');
    }
    try {
        const productIds = products.map(product => product.id);
        const dbProducts = await prismaClient_1.default.product.findMany({
            where: { id: { in: productIds } }
        });
        if (dbProducts.length !== productIds.length) {
            throw new error_1.NotFoundError('Some products were not found.');
        }
        // Map the products from the database for quick access
        const productMap = new Map(dbProducts.map(product => [product.id, product]));
        let totalAmount = 0;
        const orderProducts = [];
        products.forEach(product => {
            const dbProduct = productMap.get(product.id);
            if (!dbProduct) {
                throw new error_1.NotFoundError(`Product with ID ${product.id} not found`);
            }
            if (dbProduct.inventory < product.quantity) {
                throw new error_1.ServiceError(`Insufficient inventory for product ID ${product.id}`);
            }
            totalAmount += dbProduct.price * product.quantity;
            orderProducts.push({
                productId: product.id,
                quantity: product.quantity,
            });
        });
        // Deduct wallet balance
        const wallet = await (0, wallet_1.getUserWallet)(userId);
        if (wallet.balance < totalAmount) {
            throw new error_1.ServiceError('Insufficient wallet balance.');
        }
        // Deduct the wallet balance
        const transaction = await (0, wallet_1.deductWalletBalance)(userId, totalAmount);
        // Create the order with embedded products
        const order = await prismaClient_1.default.order.create({
            data: {
                userId,
                products: orderProducts, // Embedded products passed directly
                totalAmount,
                paymentStatus: 'COMPLETED',
                transactionId: transaction.id,
                deliveryAddress,
            },
        });
        // Update product inventory after the order is created
        for (const product of products) {
            await prismaClient_1.default.product.update({
                where: { id: product.id },
                data: { inventory: { decrement: product.quantity } }
            });
        }
        logger_1.default.info(`Order created successfully for user: ${userId}, order ID: ${order.id}`);
        return order;
    }
    catch (error) {
        handleError(error, 'Error creating order');
    }
};
exports.createOrder = createOrder;
const getOrderById = async (userId, orderId) => {
    try {
        const order = await prismaClient_1.default.order.findUnique({
            where: { id: orderId },
            include: {
                transaction: true
            }
        });
        if (!order) {
            throw new error_1.NotFoundError(`Order with ID ${orderId} not found.`);
        }
        if (order.userId !== userId) {
            throw new error_1.ServiceError('Forbidden: You do not have access to this order.');
        }
        return order;
    }
    catch (error) {
        handleError(error, 'Error fetching order by ID');
    }
};
exports.getOrderById = getOrderById;
const getUserOrders = async (userId) => {
    try {
        const orders = await prismaClient_1.default.order.findMany({
            where: { userId },
            include: {
                transaction: true
            }
        });
        return orders;
    }
    catch (error) {
        handleError(error, `Error fetching orders for user ${userId}`);
    }
};
exports.getUserOrders = getUserOrders;
const getAllOrders = async () => {
    try {
        const orders = await prismaClient_1.default.order.findMany({
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
            logger_1.default.info('No orders found.');
        }
        return orders;
    }
    catch (error) {
        handleError(error, 'Error fetching all orders for admin');
    }
};
exports.getAllOrders = getAllOrders;
