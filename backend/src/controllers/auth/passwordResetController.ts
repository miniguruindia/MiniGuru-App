// /workspaces/MiniGuru-App/backend/src/controllers/auth/passwordResetController.ts

import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../utils/prismaClient';
import logger from '../../logger';

// Store reset tokens in memory (in production, use Redis or database)
const resetTokens = new Map<string, { email: string; expires: number }>();

/**
 * @description Request password reset - generates temp password (dev) or reset token (prod)
 * @route POST /auth/forgot-password
 * @access Public
 */
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    logger.info({ email }, '🔐 Password reset requested');

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // For security, don't reveal if user exists or not
      logger.info({ email }, '⚠️  Password reset requested for non-existent email');
      return res.json({ 
        message: 'If that email exists, we sent password reset instructions.' 
      });
    }

    // DEVELOPMENT MODE: Generate and return temporary password
    if (process.env.NODE_ENV === 'development') {
      // Generate 8-character temporary password
      const tempPassword = crypto.randomBytes(4).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Update user's password
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      logger.info({ email }, `✅ Temporary password generated: ${tempPassword}`);

      // Return temp password directly (DEVELOPMENT ONLY!)
      return res.json({
        message: 'Password reset successful',
        tempPassword: tempPassword,
        note: 'This is a temporary password. Please log in and change it immediately.',
      });
    }

    // PRODUCTION MODE: Generate reset token and send email
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour expiration

    // Store token (in production, use database or Redis)
    resetTokens.set(resetToken, { email: user.email, expires });

    logger.info({ email }, '✅ Password reset token generated');

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

  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Password reset request error');
    res.status(500).json({ 
      error: 'Failed to process password reset request' 
    });
  }
};

/**
 * @description Reset password using token
 * @route POST /auth/reset-password
 * @access Public
 */
export const resetPassword = async (req: Request, res: Response) => {
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
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await prisma.user.update({
      where: { email: tokenData.email },
      data: { passwordHash },
    });

    // Delete used token
    resetTokens.delete(token);

    logger.info({ email: tokenData.email }, '✅ Password reset successful');

    res.json({ 
      message: 'Password reset successful. You can now log in with your new password.' 
    });

  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Password reset error');
    res.status(500).json({ 
      error: 'Failed to reset password' 
    });
  }
};