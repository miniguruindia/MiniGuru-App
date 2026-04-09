"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const logger_1 = __importDefault(require("../../logger"));
const client_1 = require("@prisma/client");
const error_1 = require("../../utils/error");
const handleError = (error, context) => {
    logger_1.default.error(`${context}: ${error.message}`);
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        throw new error_1.ServiceError('A database error occurred.');
    }
    throw new error_1.ServiceError('An unexpected error occurred.');
};
const getStats = async () => {
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
        // Aggregate counts
        const [usersCount, projectsCount, ordersCount, productsCount] = await Promise.all([
            prismaClient_1.default.user.count(),
            prismaClient_1.default.project.count(),
            prismaClient_1.default.order.count(),
            prismaClient_1.default.product.count(),
        ]);
        // New records in the last 7 days
        const [newUsersCount, newProjectsCount, newOrdersCount] = await Promise.all([
            prismaClient_1.default.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
            prismaClient_1.default.project.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
            prismaClient_1.default.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        ]);
        return {
            total: {
                users: usersCount,
                projects: projectsCount,
                orders: ordersCount,
                products: productsCount,
            },
            new: {
                users: newUsersCount,
                projects: newProjectsCount,
                orders: newOrdersCount,
            },
        };
    }
    catch (error) {
        handleError(error, 'Error fetching stats');
    }
};
exports.getStats = getStats;
