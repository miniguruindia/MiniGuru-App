"use strict";
// /workspaces/MiniGuru-App/backend/src/controllers/auth/passwordResetController.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.requestPasswordReset = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const logger_1 = __importDefault(require("../../logger"));
// Store reset tokens in memory (in production, use Redis or database)
const resetTokens = new Map();
/**
 * @description Request password reset - generates temp password (dev) or reset token (prod)
 * @route POST /auth/forgot-password
 * @access Public
 */
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        logger_1.default.info({ email }, '🔐 Password reset requested');
        // Find user by email
        const user = await prismaClient_1.default.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (!user) {
            // For security, don't reveal if user exists or not
            logger_1.default.info({ email }, '⚠️  Password reset requested for non-existent email');
            return res.json({
                message: 'If that email exists, we sent password reset instructions.'
            });
        }
        // DEVELOPMENT MODE: Generate and return temporary password
        if (process.env.NODE_ENV === 'development') {
            // Generate 8-character temporary password
            const tempPassword = crypto_1.default.randomBytes(4).toString('hex');
            const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
            // Update user's password
            await prismaClient_1.default.user.update({
                where: { id: user.id },
                data: { passwordHash },
            });
            logger_1.default.info({ email }, `✅ Temporary password generated: ${tempPassword}`);
            // Return temp password directly (DEVELOPMENT ONLY!)
            return res.json({
                message: 'Password reset successful',
                tempPassword: tempPassword,
                note: 'This is a temporary password. Please log in and change it immediately.',
            });
        }
        // PRODUCTION MODE: Generate reset token and send email
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour expiration
        // Store token (in production, use database or Redis)
        resetTokens.set(resetToken, { email: user.email, expires });
        logger_1.default.info({ email }, '✅ Password reset token generated');
        // TODO: Send email with reset link
        // await sendPasswordResetEmail(user.email, resetToken);
        // Return success message
        res.json({
            message: 'Password reset instructions have been sent to your email.',
            // Development only - remove in production!
            ...(process.env.NODE_ENV === 'development' && {
                resetToken: resetToken,
                resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
            })
        });
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, '❌ Password reset request error');
        res.status(500).json({
            error: 'Failed to process password reset request'
        });
    }
};
exports.requestPasswordReset = requestPasswordReset;
/**
 * @description Reset password using token
 * @route POST /auth/reset-password
 * @access Public
 */
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        if (!token || !newPassword) {
            return res.status(400).json({
                error: 'Token and new password are required'
            });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters'
            });
        }
        // Verify token exists
        const tokenData = resetTokens.get(token);
        if (!tokenData) {
            return res.status(400).json({
                error: 'Invalid or expired reset token'
            });
        }
        // Check if token has expired
        if (Date.now() > tokenData.expires) {
            resetTokens.delete(token);
            return res.status(400).json({
                error: 'Reset token has expired. Please request a new one.'
            });
        }
        // Hash new password
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        // Update user's password
        await prismaClient_1.default.user.update({
            where: { email: tokenData.email },
            data: { passwordHash },
        });
        // Delete used token
        resetTokens.delete(token);
        logger_1.default.info({ email: tokenData.email }, '✅ Password reset successful');
        res.json({
            message: 'Password reset successful. You can now log in with your new password.'
        });
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, '❌ Password reset error');
        res.status(500).json({
            error: 'Failed to reset password'
        });
    }
};
exports.resetPassword = resetPassword;
