import prisma from '../../utils/prismaClient';
import logger from '../../logger';
import { Prisma } from '@prisma/client';
import { ServiceError } from '../../utils/error';

const handleError = (error: unknown, context: string): never => {
    logger.error(`${context}: ${(error as Error).message}`);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ServiceError('A database error occurred.');
    }
    throw new ServiceError('An unexpected error occurred.');
};

export const getStats = async () => {
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));

        // Aggregate counts
        const [usersCount, projectsCount, ordersCount, productsCount] = await Promise.all([
            prisma.user.count(),
            prisma.project.count(),
            prisma.order.count(),
            prisma.product.count(),
        ]);

        // New records in the last 7 days
        const [newUsersCount, newProjectsCount, newOrdersCount] = await Promise.all([
            prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
            prisma.project.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
            prisma.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
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
    } catch (error) {
        handleError(error, 'Error fetching stats');
    }
};
