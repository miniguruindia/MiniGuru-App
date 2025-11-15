import { Request, Response } from 'express';
import prisma from '../../utils/prismaClient';
import { handlePrismaError } from '../../utils/error';
import logger from '../../logger';

const userSelectAttributes = {
    id: true,
    email: true,
    name: true,
    age: true,
    role: true,
    createdAt: true,
    updatedAt: true,
    score: true,
    wallet: true,
    scoreHistory:true,
    phoneNumber:true,
};

const getUserDetails = async (req: Request, res: Response) => {
    try {
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: req.user?.userId }, // Ensure userId exists in the token
            select: {
                ...userSelectAttributes,
                projects: { select: { id: true } }, // Only select project IDs for counting
            },
        });

        const totalProjects = user.projects.length;
        res.json({
            user: {
                ...user,
                totalProjects, 
            },
        });
    } catch (error) {
        logger.error({ error: (error as Error).message }, 'Failed to retrieve user details');
        const handledError = handlePrismaError(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};
// Update user details
const updateUserDetails = async (req: Request, res: Response) => {
    const { email, name, age , role , phoneNumber , score , wallet } = req.body;
    try {
        const updatedUser = await prisma.user.update({
            where: { id: req.user?.userId },
            data: {
                email: email || undefined, // Only update if new data is provided
                name: name || undefined,
                age: age ? parseInt(age, 10) : undefined,
                role: role || undefined,
                phoneNumber: phoneNumber || undefined,
                score: score ? parseInt(score, 10) : undefined,
                wallet: wallet,
            },
            select: userSelectAttributes,
        });

        res.json(updatedUser);
    } catch (error) {
        logger.error({ error: (error as Error).message }, 'Failed to update user details');
        const handledError = handlePrismaError(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};

// List all users with pagination (only showing specific fields)
const listUsers = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const skip = (page - 1) * limit;

    try {
        const users = await prisma.user.findMany({
            skip,
            take: limit,
            select: {
                name: true,
                email: true,
                phoneNumber: true,
                age: true,
                id: true,
            },
        });

        const totalUsers = await prisma.user.count();
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({
            data: users,
            meta: {
                totalUsers,
                totalPages,
                currentPage: page,
                pageSize: limit,
            },
        });
    } catch (error) {
        logger.error({ error: (error as Error).message }, 'Failed to list users');
        const handledError = handlePrismaError(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};

const getUserById = async (req: Request, res: Response) => {
    const { userId } = req.params; 
    

    try {
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: {
                ...userSelectAttributes,
                projects: { select: { id: true, title:true } }, // Only select project IDs for counting
            },
        });

        const totalProjects = user.projects.length;
        res.json({
            user: {
                ...user,
                totalProjects, 
            },
        });
    }
    catch (error) {
        logger.error({ error: (error as Error).message }, `Failed to retrieve user with ID ${userId}`);
        const handledError = handlePrismaError(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};

// function to delete a user by id
const deleteUserById = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const user = await prisma.user.delete({
            where: { id: userId },
        });

        res.json(user);
    } catch (error) {
        logger.error({ error: (error as Error).message }, `Failed to delete user with ID ${userId}`);
        const handledError = handlePrismaError(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};


export { getUserDetails, updateUserDetails, listUsers, getUserById , deleteUserById};
