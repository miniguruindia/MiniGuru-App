import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../utils/prismaClient';
import { sendPasswordResetEmail } from '../../services/email/emailService';
import logger from '../../logger';

const resetTokens = new Map<string, { email: string; expires: number }>();

export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      logger.info({ email }, 'Password reset requested for non-existent email');
      return res.json({ 
        message: 'If that email exists, we sent password reset instructions.' 
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000;

    resetTokens.set(resetToken, { email, expires });

    await sendPasswordResetEmail(email, resetToken);

    logger.info({ email }, 'Password reset email sent');
    
    res.json({ 
      message: 'Password reset instructions have been sent to your email.' 
    });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Password reset request error');
    res.status(500).json({ 
      error: 'Failed to process password reset request' 
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  try {
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenData = resetTokens.get(token);

    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (Date.now() > tokenData.expires) {
      resetTokens.delete(token);
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email: tokenData.email },
      data: { passwordHash },
    });

    resetTokens.delete(token);

    logger.info({ email: tokenData.email }, 'Password reset successful');

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Password reset error');
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
