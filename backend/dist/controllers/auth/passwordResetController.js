"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.requestPasswordReset = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const logger_1 = __importDefault(require("../../logger"));
const emailService_1 = require("../../services/email/emailService");
const JWT_SECRET = process.env.JWT_SECRET || 'miniguru-reset-secret';
/**
 * @route  POST /auth/forgot-password
 * @access Public
 */
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        logger_1.default.info({ email }, '🔐 Password reset requested');
        const user = await prismaClient_1.default.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        // Security: always return same message whether user exists or not
        if (!user) {
            logger_1.default.info({ email }, '⚠️  Reset requested for non-existent email');
            return res.json({ message: 'If that email exists, we sent password reset instructions.' });
        }
        // JWT token — signed with user id + email, expires in 1 hour
        // Survives Cloud Run restarts (stateless)
        const resetToken = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, purpose: 'password-reset' }, JWT_SECRET, { expiresIn: '1h' });
        logger_1.default.info({ email }, '✅ Reset token generated, sending email...');
        // Child accounts: send to guardianEmail, fallback to user.email
        const resetTarget = user.guardianEmail || user.email;
        await (0, emailService_1.sendPasswordResetEmail)(resetTarget, resetToken);
        logger_1.default.info({ email }, '✅ Password reset email sent successfully');
        return res.json({ message: 'Password reset instructions have been sent to your email.' });
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, '❌ Password reset request error');
        return res.status(500).json({ error: 'Failed to process password reset request' });
    }
};
exports.requestPasswordReset = requestPasswordReset;
/**
 * @route  POST /auth/reset-password
 * @access Public
 */
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        // Verify JWT token
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (jwtErr) {
            return res.status(400).json({ error: 'Invalid or expired reset token. Please request a new one.' });
        }
        if (payload.purpose !== 'password-reset') {
            return res.status(400).json({ error: 'Invalid token type.' });
        }
        // Find user
        const user = await prismaClient_1.default.user.findUnique({ where: { id: payload.userId } });
        if (!user) {
            return res.status(400).json({ error: 'User not found.' });
        }
        // Hash and update password
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await prismaClient_1.default.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });
        logger_1.default.info({ email: user.email }, '✅ Password reset successful');
        return res.json({ message: 'Password reset successful. You can now log in with your new password.' });
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, '❌ Password reset error');
        return res.status(500).json({ error: 'Failed to reset password' });
    }
};
exports.resetPassword = resetPassword;
