"use strict";
// /workspaces/MiniGuru-App/backend/src/controllers/auth/authController.ts
// COMPLETE FILE - Replace entire file with this
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeLoginId = exports.changePassword = exports.resetPassword = exports.forgotPassword = exports.register = exports.refreshToken = exports.logout = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const express_validator_1 = require("express-validator");
const authService_1 = require("../../services/authService");
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const logger_1 = __importDefault(require("../../logger"));
const library_1 = require("@prisma/client/runtime/library");
const resetTokens = new Map();
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const handlePrismaError = (error) => {
    if (error instanceof library_1.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            const target = error.meta?.target;
            if (target?.includes('email')) {
                return { error: 'Email already in use.' };
            }
            if (target?.includes('phoneNumber')) {
                return { error: 'Phone number already in use.' };
            }
        }
        if (error.code === 'P2025') {
            return { error: 'User not found.' };
        }
    }
    return { error: 'An unexpected error occurred.' };
};
// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        logger_1.default.info({ email }, 'Attempting to log in user');
        const user = await (0, authService_1.authenticateUser)(email, password);
        const accessToken = (0, authService_1.generateAccessToken)(user.id, user.role);
        const refreshToken = (0, authService_1.generateRefreshToken)(user.id);
        await prismaClient_1.default.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });
        res.json({ accessToken, refreshToken });
    }
    catch (error) {
        logger_1.default.error({ email, error: error.message }, 'Login failed');
        res.status(401).json({ error: 'Invalid credentials' });
    }
};
exports.login = login;
const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    try {
        const decoded = await (0, authService_1.verifyToken)(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await prismaClient_1.default.user.findUnique({ where: { id: decoded.userId } });
        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ error: 'Invalid refresh token' });
        }
        const newAccessToken = (0, authService_1.generateAccessToken)(user.id, user.role);
        res.json({ accessToken: newAccessToken });
    }
    catch (error) {
        logger_1.default.error({ refreshToken, error: error.message }, 'Token refresh failed');
        res.status(403).json(handlePrismaError(error));
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res) => {
    const { refreshToken } = req.body;
    try {
        const decoded = await (0, authService_1.verifyToken)(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        await prismaClient_1.default.user.update({
            where: { id: decoded.userId },
            data: { refreshToken: null },
        });
        res.status(204).send();
    }
    catch (error) {
        logger_1.default.error({ refreshToken, error: error.message }, 'Logout failed');
        res.status(403).json(handlePrismaError(error));
    }
};
exports.logout = logout;
// ============================================================================
// USER REGISTRATION
// ============================================================================
const register = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error' });
    }
    const { email, password, name, age, phoneNumber } = req.body;
    try {
        const emailExists = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (emailExists) {
            return res.status(400).json({ error: 'User with this email already exists.' });
        }
        if (phoneNumber?.trim()) {
            const phoneExists = await prismaClient_1.default.user.findFirst({ where: { phoneNumber: phoneNumber.trim() } });
            if (phoneExists) {
                return res.status(400).json({ error: 'User with this phone number already exists.' });
            }
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const newUser = await prismaClient_1.default.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                name,
                age: parseInt(age, 10),
                phoneNumber,
                role: 'USER',
                score: 100,
                wallet: {
                    create: {
                        balance: 0,
                    },
                },
            },
            include: {
                wallet: true,
            },
        });
        logger_1.default.info({
            userId: newUser.id,
            email,
            walletId: newUser.wallet?.id
        }, '✅ User and wallet created successfully');
        const accessToken = (0, authService_1.generateAccessToken)(newUser.id, newUser.role);
        const refreshToken = (0, authService_1.generateRefreshToken)(newUser.id);
        await prismaClient_1.default.user.update({
            where: { id: newUser.id },
            data: { refreshToken },
        });
        logger_1.default.info({ userId: newUser.id, email }, '✅ Registration complete');
        res.status(201).json({ accessToken, refreshToken });
    }
    catch (error) {
        logger_1.default.error({ email, error: error.message }, '❌ User registration failed');
        res.status(500).json(handlePrismaError(error));
    }
};
exports.register = register;
// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        logger_1.default.info({ email }, '🔐 Password reset requested');
        const user = await prismaClient_1.default.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (!user) {
            logger_1.default.warn({ email }, '⚠️  Password reset requested for non-existent user');
            return res.status(200).json({
                message: 'If an account exists with this email, a reset link has been sent.',
            });
        }
        if (process.env.NODE_ENV === 'development') {
            const tempPassword = crypto_1.default.randomBytes(4).toString('hex');
            const hashedPassword = await bcryptjs_1.default.hash(tempPassword, 10);
            await prismaClient_1.default.user.update({
                where: { id: user.id },
                data: { passwordHash: hashedPassword },
            });
            logger_1.default.info({ email, tempPassword }, `✅ Temporary password generated: ${tempPassword}`);
            return res.status(200).json({
                message: 'Password reset successful',
                tempPassword: tempPassword,
                note: 'This is a temporary password. Please log in and change it immediately.',
            });
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000;
        resetTokens.set(resetToken, { email: user.email, expires });
        logger_1.default.info({ email }, '✅ Password reset token generated');
        res.status(200).json({
            message: 'Password reset instructions have been sent to your email.',
            ...(process.env.NODE_ENV === 'development' && {
                resetToken: resetToken,
                resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
            })
        });
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, '❌ Password reset request error');
        res.status(500).json({ error: 'Password reset failed' });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const tokenData = resetTokens.get(token);
        if (!tokenData) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        if (Date.now() > tokenData.expires) {
            resetTokens.delete(token);
            return res.status(400).json({ error: 'Reset token has expired' });
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await prismaClient_1.default.user.update({
            where: { email: tokenData.email },
            data: { passwordHash },
        });
        resetTokens.delete(token);
        logger_1.default.info({ email: tokenData.email }, '✅ Password reset successful');
        res.status(200).json({
            message: 'Password reset successful. You can now log in with your new password.'
        });
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, '❌ Password reset error');
        res.status(500).json({ error: 'Failed to reset password' });
    }
};
exports.resetPassword = resetPassword;
/**
* @description Change password for authenticated user
* @route POST /auth/change-password
* @access Private (requires authentication)
* ✅ FIXED WITH FULL DEBUG
*/
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    // 🔍 FULL DEBUG - Check all possible places userId could be
    console.log('\n==================== CHANGE PASSWORD DEBUG ====================');
    console.log('📋 Request Headers:', {
        authorization: req.headers.authorization,
        'content-type': req.headers['content-type']
    });
    console.log('👤 req.user:', req.user);
    console.log('👤 req.userId:', req.userId);
    console.log('👤 All req keys:', Object.keys(req).filter(k => k.includes('user') || k.includes('User')));
    console.log('===============================================================\n');
    // ✅ Try EVERY possible way to get userId
    let userId;
    // Method 1: Standard req.user.userId
    if (req.user?.userId) {
        userId = req.user.userId;
        console.log('✅ Found userId via req.user.userId:', userId);
    }
    // Method 2: Alternative req.userId
    else if (req.userId) {
        userId = req.userId;
        console.log('✅ Found userId via req.userId:', userId);
    }
    // Method 3: req.user.id (some middleware use this)
    else if (req.user?.id) {
        userId = req.user.id;
        console.log('✅ Found userId via req.user.id:', userId);
    }
    // Method 4: Manually decode the token if middleware failed
    else if (req.headers.authorization) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = await (0, authService_1.verifyToken)(token, process.env.ACCESS_TOKEN_SECRET);
            userId = decoded.userId;
            console.log('✅ Found userId by manually decoding token:', userId);
        }
        catch (e) {
            console.log('❌ Failed to manually decode token:', e);
        }
    }
    try {
        logger_1.default.info({
            userId,
            hasUser: !!req.user,
            userObject: req.user,
            hasCurrentPassword: !!currentPassword,
            hasNewPassword: !!newPassword
        }, '🔐 Change password request');
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }
        if (!userId) {
            logger_1.default.error('❌ No userId found after trying all methods');
            return res.status(401).json({ message: 'User not authenticated' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isCurrentPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            logger_1.default.warn({ userId }, '❌ Current password is incorrect');
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        const newPasswordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash },
        });
        logger_1.default.info({ userId, email: user.email }, '✅ Password changed successfully');
        res.status(200).json({
            message: 'Password changed successfully'
        });
    }
    catch (error) {
        logger_1.default.error({ userId, error: error.message }, '❌ Password change error');
        res.status(500).json({ message: 'Failed to change password' });
    }
};
exports.changePassword = changePassword;
/**
* @route POST /auth/change-login-id
* @access Private (requires authentication)
* Self-service MiniGuru ID change — for child accounts whose login isn't a real
* email anyway. New ID must keep the @miniguru.in suffix and be available.
*/
const changeLoginId = async (req, res) => {
    const { currentPassword, newLoginId } = req.body;
    const userId = req.user?.userId;
    try {
        if (!currentPassword || !newLoginId) {
            return res.status(400).json({ message: 'Current password and new MiniGuru ID are required' });
        }
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const cleanId = String(newLoginId).trim().toLowerCase();
        if (!/^[a-z0-9._-]+@miniguru\.in$/.test(cleanId)) {
            return res.status(400).json({
                message: 'MiniGuru ID must end with @miniguru.in and can only use letters, numbers, dots or hyphens before that',
            });
        }
        const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) {
            logger_1.default.warn({ userId }, '❌ Current password is incorrect (change-login-id)');
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        if (cleanId === user.email) {
            return res.status(200).json({ message: 'That is already your MiniGuru ID', loginId: cleanId });
        }
        const taken = await prismaClient_1.default.user.findUnique({ where: { email: cleanId } });
        if (taken) {
            return res.status(409).json({ message: 'That MiniGuru ID is already taken — try another' });
        }
        await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { email: cleanId },
        });
        logger_1.default.info({ userId, oldId: user.email, newId: cleanId }, '✅ MiniGuru ID changed successfully');
        res.status(200).json({ message: 'MiniGuru ID changed successfully', loginId: cleanId });
    }
    catch (error) {
        logger_1.default.error({ userId, error: error.message }, '❌ MiniGuru ID change error');
        res.status(500).json({ message: 'Failed to change MiniGuru ID' });
    }
};
exports.changeLoginId = changeLoginId;
