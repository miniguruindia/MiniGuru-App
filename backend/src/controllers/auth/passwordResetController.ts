// backend/src/controllers/auth/passwordResetController.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../utils/prismaClient';
import logger from '../../logger';
import { sendPasswordResetEmail } from '../../services/email/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'miniguru-reset-secret';

/**
 * @route  POST /auth/forgot-password
 * @access Public
 */
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    logger.info({ email }, '🔐 Password reset requested');

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Security: always return same message whether user exists or not
    if (!user) {
      logger.info({ email }, '⚠️  Reset requested for non-existent email');
      return res.json({ message: 'If that email exists, we sent password reset instructions.' });
    }

    // JWT token — signed with user id + email, expires in 1 hour
    // Survives Cloud Run restarts (stateless)
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    logger.info({ email }, '✅ Reset token generated, sending email...');

    const sent = await sendPasswordResetEmail(user.email, resetToken);

    if (!sent) {
      logger.error({ email }, '❌ Email service failed to send reset email');
      return res.status(500).json({ error: 'Failed to send reset email. Please try again later.' });
    }

    logger.info({ email }, '✅ Password reset email sent successfully');
    return res.json({ message: 'Password reset instructions have been sent to your email.' });

  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Password reset request error');
    return res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

/**
 * @route  POST /auth/reset-password
 * @access Public
 */
export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  try {
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Verify JWT token
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(400).json({ error: 'Invalid or expired reset token. Please request a new one.' });
    }

    if (payload.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid token type.' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    // Hash and update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    logger.info({ email: user.email }, '✅ Password reset successful');
    return res.json({ message: 'Password reset successful. You can now log in with your new password.' });

  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Password reset error');
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};
