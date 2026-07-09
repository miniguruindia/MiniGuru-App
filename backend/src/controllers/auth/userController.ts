// /workspaces/MiniGuru-App/backend/src/controllers/auth/userController.ts

import { Request, Response } from 'express';
import prisma from '../../utils/prismaClient';
import { handlePrismaError } from '../../utils/error';
import logger from '../../logger';
import bcrypt from 'bcryptjs';

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
    profilePhoto: true,
    isMentor: true,
    guardianEmail: true,
    emailVerified: true,
    phoneVerified: true,
    mentorType: true,
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
                profilePhoto: user.profilePhoto ?? null,
                isMentor: user.isMentor ?? false,
                guardianEmail: user.guardianEmail ?? null,
                emailVerified: user.emailVerified ?? false,
                phoneVerified: user.phoneVerified ?? false,
                mentorType: user.mentorType ?? null,
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
    const { userId } = req.params;
    const { email, name, age, role, phoneNumber, score, wallet, password } = req.body;
    
    try {
        // Check if this is an admin updating another user or a user updating themselves
        const isAdminUpdate = req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN';
        const targetUserId = isAdminUpdate ? userId : req.user?.id;

        if (!targetUserId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Prepare update data
        const updateData: any = {
            email: email || undefined,
            name: name || undefined,
            age: age ? parseInt(age, 10) : undefined,
            role: role || undefined,
            phoneNumber: phoneNumber || undefined,
            score: score ? parseInt(score, 10) : undefined,
            wallet: wallet,
        };

        // Handle password update (only for admins)
        if (password && password.trim() && isAdminUpdate) {
            const saltRounds = 12;
            updateData.passwordHash = await bcrypt.hash(password, saltRounds);
        }

        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: updateData,
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
    const limit = parseInt(req.query.limit as string, 10) || 500;
    const skip = (page - 1) * limit;

    try {
        const users = await prisma.user.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                name: true,
                email: true,
                phoneNumber: true,
    profilePhoto: true,
    isMentor: true,
    guardianEmail: true,
    mentorType: true,
                age: true,
                id: true,
                score: true,
                createdAt: true,
                wallet: { select: { balance: true } },
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
                passwordHash: true, // Include password hash for admin access
                projects: { select: { id: true, title: true, status: true } },
                orders: {
                  select: {
                    id: true, totalAmount: true, paymentStatus: true,
                    fulfillmentStatus: true, courierName: true, trackingNumber: true,
                    estimatedDelivery: true, deliveryAddress: true, createdAt: true, products: true,
                  },
                  orderBy: { createdAt: 'desc' },
                },
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
                profilePhoto: user.profilePhoto ?? null,
                isMentor: user.isMentor ?? false,
                guardianEmail: user.guardianEmail ?? null,
                emailVerified: user.emailVerified ?? false,
                phoneVerified: user.phoneVerified ?? false,
                mentorType: user.mentorType ?? null,
                passwordHash: user.passwordHash, // Include password hash for admin access
                projects: user.projects,
                orders: user.orders ?? [],
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