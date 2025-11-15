import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import { generateAccessToken, generateRefreshToken, authenticateUser, verifyToken } from '../../services/authService';
import prisma from '../../utils/prismaClient';
import logger from '../../logger';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Common error response type
type ErrorResponse = {
    error: string;
};

// Helper function to handle Prisma errors
const handlePrismaError = (error: unknown): ErrorResponse => {
    if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') { // Unique constraint violation
            const target = error.meta?.target as string[] | undefined;
            if (target?.includes('email')) {
                return { error: 'Email already in use.' };
            }
            if (target?.includes('phoneNumber')) {
                return { error: 'Phone number already in use.' };
            }
        }
        if (error.code === 'P2025') { // Record not found
            return { error: 'User not found.' };
        }
    }
    return { error: 'An unexpected error occurred.' };
};


const login = async (req: Request, res: Response<ErrorResponse | { accessToken: string; refreshToken: string }>) => {
    const { email, password } = req.body;

    try {
        logger.info({ email }, 'Attempting to log in user');
        const user = await authenticateUser(email, password); // Verify credentials
        const accessToken = generateAccessToken(user.id, user.role); // Generate JWT
        const refreshToken = generateRefreshToken(user.id); // Generate Refresh Token

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });

        res.json({ accessToken, refreshToken });
    } catch (error) {
        logger.error({ email, error: (error as Error).message }, 'Login failed');
        res.status(401).json({ error: 'Invalid credentials' });
    }
};

/**
 * @description Refresh the access token using a refresh token
 * @route POST /auth/refresh-token
 * @access Public
 */
const refreshToken = async (req: Request, res: Response<ErrorResponse | { accessToken: string }>) => {
    const { refreshToken } = req.body;

    try {
        const decoded = await verifyToken(refreshToken, process.env.REFRESH_TOKEN_SECRET as string);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ error: 'Invalid refresh token' });
        }

        const newAccessToken = generateAccessToken(user.id,user.role);
        res.json({ accessToken: newAccessToken });
    } catch (error) {
        logger.error({ refreshToken, error: (error as Error).message }, 'Token refresh failed');
        res.status(403).json(handlePrismaError(error));
    }
};

/**
 * @description Log out the user by invalidating their refresh token
 * @route POST /auth/logout
 * @access Public
 */
const logout = async (req: Request, res: Response<ErrorResponse>) => {
    const { refreshToken } = req.body;

    try {
        const decoded = await verifyToken(refreshToken, process.env.REFRESH_TOKEN_SECRET as string);
        await prisma.user.update({
            where: { id: decoded.userId },
            data: { refreshToken: null },
        });

        res.status(204).send();
    } catch (error) {
        logger.error({ refreshToken, error: (error as Error).message }, 'Logout failed');
        res.status(403).json(handlePrismaError(error));
    }
};



/**
 * @description Register a new user with email, password, name, age, phoneNumber, and wallet creation
 * @route POST /auth/register
 * @access Public
 */
const register = async (req: Request, res: Response<ErrorResponse | { accessToken: string; refreshToken: string }>) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error' });
    }

    const { email, password, name, age, phoneNumber } = req.body;

    try {
        // Check if user already exists (email or phone number)
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { phoneNumber },
                ],
            },
        });

        if (existingUser) {
            return res.status(400).json({
                error: existingUser.email === email
                    ? 'User with this email already exists.'
                    : 'User with this phone number already exists.',
            });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const newUser = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                name,
                age: parseInt(age, 10),
                phoneNumber,
            },
        });

        // Create a new wallet for the user
        const newWallet = await prisma.wallet.create({
            data: {
                balance: 0.0, // Initialize with 0 balance
                userId: newUser.id,
            },
        });

        // Update the user with the walletId
        await prisma.user.update({
            where: { id: newUser.id },
            data: { walletId: newWallet.id },
        });

        // Generate tokens
        const accessToken = generateAccessToken(newUser.id, newUser.role);
        const refreshToken = generateRefreshToken(newUser.id);

        // Save refresh token in the database
        await prisma.user.update({
            where: { id: newUser.id },
            data: { refreshToken },
        });

        res.status(201).json({ accessToken, refreshToken });
    } catch (error) {
        logger.error({ error: (error as Error).message }, 'User registration failed');
        res.status(500).json(handlePrismaError(error));
    }
};

export { login, logout, refreshToken, register };
