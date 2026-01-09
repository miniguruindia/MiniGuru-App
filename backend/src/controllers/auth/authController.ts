// /workspaces/MiniGuru-App/backend/src/controllers/auth/authController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import { generateAccessToken, generateRefreshToken, authenticateUser, verifyToken } from '../../services/authService';
import prisma from '../../utils/prismaClient';
import logger from '../../logger';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Common error response type
type ErrorResponse = {
    error: string;
};

// Store reset tokens in memory (in production, use Redis or database)
const resetTokens = new Map<string, { email: string; expires: number }>();

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

/**
 * @description Login user
 * @route POST /auth/login
 * @access Public
 */
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

        const newAccessToken = generateAccessToken(user.id, user.role);
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

/**
 * @description Request password reset (generates temp password or reset token)
 * @route POST /auth/forgot-password
 * @access Public
 */
const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        logger.info({ email }, '🔐 Password reset requested');

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (!user) {
            // For security, don't reveal if user exists
            logger.warn({ email }, '⚠️  Password reset requested for non-existent user');
            return res.status(200).json({
                message: 'If an account exists with this email, a reset link has been sent.',
            });
        }

        // OPTION 1: Generate temporary password (for development)
        if (process.env.NODE_ENV === 'development') {
            const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 character temp password
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            await prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: hashedPassword },
            });

            logger.info({ email }, `✅ Temporary password generated: ${tempPassword}`);

            return res.status(200).json({
                message: 'Password reset successful',
                tempPassword: tempPassword,
                note: 'This is a temporary password. Please log in and change it immediately.',
            });
        }

        // OPTION 2: Generate reset token (for production)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour

        // Store token in memory (in production, use database or Redis)
        resetTokens.set(resetToken, { email: user.email, expires });

        logger.info({ email }, '✅ Password reset token generated');

        // TODO: Send email with reset link
        // await sendPasswordResetEmail(user.email, resetToken);

        res.status(200).json({
            message: 'Password reset instructions have been sent to your email.',
            // Development only - remove in production!
            ...(process.env.NODE_ENV === 'development' && {
                resetToken: resetToken,
                resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
            })
        });

    } catch (error: any) {
        logger.error({ error: error.message }, '❌ Password reset request error');
        res.status(500).json({ error: 'Password reset failed' });
    }
};

/**
 * @description Reset password using token
 * @route POST /auth/reset-password
 * @access Public
 */
const resetPassword = async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    try {
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Verify token
        const tokenData = resetTokens.get(token);

        if (!tokenData) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Check if token expired
        if (Date.now() > tokenData.expires) {
            resetTokens.delete(token);
            return res.status(400).json({ error: 'Reset token has expired' });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { email: tokenData.email },
            data: { passwordHash },
        });

        // Delete used token
        resetTokens.delete(token);

        logger.info({ email: tokenData.email }, '✅ Password reset successful');

        res.status(200).json({ message: 'Password reset successful. You can now log in with your new password.' });

    } catch (error: any) {
        logger.error({ error: error.message }, '❌ Password reset error');
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

export { login, logout, refreshToken, register, forgotPassword, resetPassword };