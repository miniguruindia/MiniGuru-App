"use strict";
// /workspaces/MiniGuru-App/backend/src/controllers/auth/userController.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserById = exports.getUserById = exports.listUsers = exports.updateUserDetails = exports.getUserDetails = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const error_1 = require("../../utils/error");
const logger_1 = __importDefault(require("../../logger"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
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
    mentorType: true,
};
// FIXED: Get user details with proper wallet structure
const getUserDetails = async (req, res) => {
    try {
        // ✅ FIXED: Changed from req.user?.userId to req.user?.id
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = await prismaClient_1.default.user.findUniqueOrThrow({
            where: { id: req.user.id }, // ✅ Changed here
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
                mentorType: user.mentorType ?? null,
            },
        });
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, 'Failed to retrieve user details');
        const handledError = (0, error_1.handlePrismaError)(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};
exports.getUserDetails = getUserDetails;
// Update user details
const updateUserDetails = async (req, res) => {
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
        const updateData = {
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
            updateData.passwordHash = await bcryptjs_1.default.hash(password, saltRounds);
        }
        const updatedUser = await prismaClient_1.default.user.update({
            where: { id: targetUserId },
            data: updateData,
            select: userSelectAttributes,
        });
        res.json(updatedUser);
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, 'Failed to update user details');
        const handledError = (0, error_1.handlePrismaError)(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};
exports.updateUserDetails = updateUserDetails;
// List all users with pagination
const listUsers = async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    try {
        const users = await prismaClient_1.default.user.findMany({
            skip,
            take: limit,
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
            },
        });
        const totalUsers = await prismaClient_1.default.user.count();
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
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, 'Failed to list users');
        const handledError = (0, error_1.handlePrismaError)(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};
exports.listUsers = listUsers;
// Get user by ID
const getUserById = async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await prismaClient_1.default.user.findUniqueOrThrow({
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
                mentorType: user.mentorType ?? null,
                passwordHash: user.passwordHash, // Include password hash for admin access
                projects: user.projects,
                orders: user.orders ?? [],
            },
        });
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, `Failed to retrieve user with ID ${userId}`);
        const handledError = (0, error_1.handlePrismaError)(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};
exports.getUserById = getUserById;
// Delete user by ID
const deleteUserById = async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await prismaClient_1.default.user.delete({
            where: { id: userId },
        });
        res.json(user);
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, `Failed to delete user with ID ${userId}`);
        const handledError = (0, error_1.handlePrismaError)(error);
        res.status(handledError.code).json({ error: handledError.message });
    }
};
exports.deleteUserById = deleteUserById;
