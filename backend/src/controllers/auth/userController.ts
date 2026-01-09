// /workspaces/MiniGuru-App/backend/src/controllers/auth/userController.ts

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
    scoreHistory: true,
    phoneNumber: true,
};

// FIXED: Get user details with proper wallet structure
const getUserDetails = async (req: Request, res: Response) => {
    try {
        // ✅ FIXED: Changed from req.user?.userId to req.user?.id
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const user = await prisma.user.findUniqueOrThrow({
            where: { id: req.user.id },  // ✅ Changed here
            select: {
                ...userSelectAttributes,
                projects: { select: { id: true } },
            },
        });

        const totalProjects = user.projects.length;
        
        // Extract wallet balance safely
        const walletBalance = user.wallet?.balance ?? 0;

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                age: user.age,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                score: user.score ?? 0,
                scoreHistory: user.scoreHistory ?? [],
                phoneNumber: user.phoneNumber,
                wallet: {
                    balance: walletBalance
                },
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
    const { email, name, age, role, phoneNumber, score, wallet } = req.body;
    try {
        // ✅ FIXED: Changed from req.user?.userId to req.user?.id
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },  // ✅ Changed here
            data: {
                email: email || undefined,
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

// List all users with pagination
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

// Get user by ID
const getUserById = async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: {
                ...userSelectAttributes,
                projects: { select: { id: true, title: true } },
            },
        });

        const totalProjects = user.projects.length;
        
        // Extract wallet balance safely
        const walletBalance = user.wallet?.balance ?? 0;

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                age: user.age,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                score: user.score ?? 0,
                scoreHistory: user.scoreHistory ?? [],
                phoneNumber: user.phoneNumber,
                wallet: {
                    balance: walletBalance
                },
                totalProjects,
                projects: user.projects,
            },
        });
    } catch (error) {
        logger.error({ error: (error as Error).message }, `Failed to retrieve user with ID ${userId}`);
        const handledError = handlePrismaError(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};

// Delete user by ID
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

export { getUserDetails, updateUserDetails, listUsers, getUserById, deleteUserById };