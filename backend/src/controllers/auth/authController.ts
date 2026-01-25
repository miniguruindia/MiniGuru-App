// /workspaces/MiniGuru-App/backend/src/controllers/auth/authController.ts
// COMPLETE FILE - Replace entire file with this


import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import { generateAccessToken, generateRefreshToken, authenticateUser, verifyToken } from '../../services/authService';
import prisma from '../../utils/prismaClient';
import logger from '../../logger';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';


// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

// ✅ AuthRequest type for authenticated routes
interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
  userId?: string; // Also check this in case middleware uses different structure
}

type ErrorResponse = {
   error: string;
};


const resetTokens = new Map<string, { email: string; expires: number }>();


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================


const handlePrismaError = (error: unknown): ErrorResponse => {
   if (error instanceof PrismaClientKnownRequestError) {
       if (error.code === 'P2002') {
           const target = error.meta?.target as string[] | undefined;
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


const login = async (req: Request, res: Response<ErrorResponse | { accessToken: string; refreshToken: string }>) => {
   const { email, password } = req.body;


   try {
       logger.info({ email }, 'Attempting to log in user');
       const user = await authenticateUser(email, password);
       const accessToken = generateAccessToken(user.id, user.role);
       const refreshToken = generateRefreshToken(user.id);


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


// ============================================================================
// USER REGISTRATION
// ============================================================================


const register = async (req: Request, res: Response<ErrorResponse | { accessToken: string; refreshToken: string }>) => {
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
       return res.status(400).json({ error: 'Validation error' });
   }


   const { email, password, name, age, phoneNumber } = req.body;


   try {
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


       const hashedPassword = await bcrypt.hash(password, 10);


       const newUser = await prisma.user.create({
           data: {
               email,
               passwordHash: hashedPassword,
               name,
               age: parseInt(age, 10),
               phoneNumber,
               role: 'USER',
               score: 0,
               wallet: {
                   create: {
                       balance: 0.0,
                   },
               },
           },
           include: {
               wallet: true,
           },
       });


       logger.info({
           userId: newUser.id,
           email,
           walletId: newUser.wallet?.id
       }, '✅ User and wallet created successfully');


       const accessToken = generateAccessToken(newUser.id, newUser.role);
       const refreshToken = generateRefreshToken(newUser.id);


       await prisma.user.update({
           where: { id: newUser.id },
           data: { refreshToken },
       });


       logger.info({ userId: newUser.id, email }, '✅ Registration complete');


       res.status(201).json({ accessToken, refreshToken });
   } catch (error) {
       logger.error({ email, error: (error as Error).message }, '❌ User registration failed');
       res.status(500).json(handlePrismaError(error));
   }
};


// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================


const forgotPassword = async (req: Request, res: Response) => {
   const { email } = req.body;


   try {
       if (!email) {
           return res.status(400).json({ error: 'Email is required' });
       }


       logger.info({ email }, '🔐 Password reset requested');


       const user = await prisma.user.findUnique({
           where: { email: email.toLowerCase() },
       });


       if (!user) {
           logger.warn({ email }, '⚠️  Password reset requested for non-existent user');
           return res.status(200).json({
               message: 'If an account exists with this email, a reset link has been sent.',
           });
       }


       if (process.env.NODE_ENV === 'development') {
           const tempPassword = crypto.randomBytes(4).toString('hex');
           const hashedPassword = await bcrypt.hash(tempPassword, 10);


           await prisma.user.update({
               where: { id: user.id },
               data: { passwordHash: hashedPassword },
           });


           logger.info({ email, tempPassword }, `✅ Temporary password generated: ${tempPassword}`);


           return res.status(200).json({
               message: 'Password reset successful',
               tempPassword: tempPassword,
               note: 'This is a temporary password. Please log in and change it immediately.',
           });
       }


       const resetToken = crypto.randomBytes(32).toString('hex');
       const expires = Date.now() + 3600000;


       resetTokens.set(resetToken, { email: user.email, expires });


       logger.info({ email }, '✅ Password reset token generated');


       res.status(200).json({
           message: 'Password reset instructions have been sent to your email.',
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


const resetPassword = async (req: Request, res: Response) => {
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


       const passwordHash = await bcrypt.hash(newPassword, 10);


       await prisma.user.update({
           where: { email: tokenData.email },
           data: { passwordHash },
       });


       resetTokens.delete(token);


       logger.info({ email: tokenData.email }, '✅ Password reset successful');


       res.status(200).json({
           message: 'Password reset successful. You can now log in with your new password.'
       });


   } catch (error: any) {
       logger.error({ error: error.message }, '❌ Password reset error');
       res.status(500).json({ error: 'Failed to reset password' });
   }
};


/**
* @description Change password for authenticated user
* @route POST /auth/change-password
* @access Private (requires authentication)
* ✅ FIXED WITH FULL DEBUG
*/
const changePassword = async (req: AuthRequest, res: Response) => {
   const { currentPassword, newPassword } = req.body;
   
   // 🔍 FULL DEBUG - Check all possible places userId could be
   console.log('\n==================== CHANGE PASSWORD DEBUG ====================');
   console.log('📋 Request Headers:', {
       authorization: req.headers.authorization,
       'content-type': req.headers['content-type']
   });
   console.log('👤 req.user:', req.user);
   console.log('👤 req.userId:', (req as any).userId);
   console.log('👤 All req keys:', Object.keys(req).filter(k => k.includes('user') || k.includes('User')));
   console.log('===============================================================\n');
   
   // ✅ Try EVERY possible way to get userId
   let userId: string | undefined;
   
   // Method 1: Standard req.user.userId
   if (req.user?.userId) {
       userId = req.user.userId;
       console.log('✅ Found userId via req.user.userId:', userId);
   }
   // Method 2: Alternative req.userId
   else if ((req as any).userId) {
       userId = (req as any).userId;
       console.log('✅ Found userId via req.userId:', userId);
   }
   // Method 3: req.user.id (some middleware use this)
   else if ((req as any).user?.id) {
       userId = (req as any).user.id;
       console.log('✅ Found userId via req.user.id:', userId);
   }
   // Method 4: Manually decode the token if middleware failed
   else if (req.headers.authorization) {
       try {
           const token = req.headers.authorization.split(' ')[1];
           const decoded = await verifyToken(token, process.env.ACCESS_TOKEN_SECRET as string);
           userId = decoded.userId;
           console.log('✅ Found userId by manually decoding token:', userId);
       } catch (e) {
           console.log('❌ Failed to manually decode token:', e);
       }
   }

   try {
       logger.info({ 
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
           logger.error('❌ No userId found after trying all methods');
           return res.status(401).json({ message: 'User not authenticated' });
       }

       if (newPassword.length < 6) {
           return res.status(400).json({ message: 'New password must be at least 6 characters' });
       }

       const user = await prisma.user.findUnique({
           where: { id: userId },
       });

       if (!user) {
           return res.status(404).json({ message: 'User not found' });
       }

       const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      
       if (!isCurrentPasswordValid) {
           logger.warn({ userId }, '❌ Current password is incorrect');
           return res.status(401).json({ message: 'Current password is incorrect' });
       }

       const newPasswordHash = await bcrypt.hash(newPassword, 10);

       await prisma.user.update({
           where: { id: userId },
           data: { passwordHash: newPasswordHash },
       });

       logger.info({ userId, email: user.email }, '✅ Password changed successfully');

       res.status(200).json({
           message: 'Password changed successfully'
       });

   } catch (error: any) {
       logger.error({ userId, error: error.message }, '❌ Password change error');
       res.status(500).json({ message: 'Failed to change password' });
   }
};


// ============================================================================
// EXPORTS
// ============================================================================


export {
   login,
   logout,
   refreshToken,
   register,
   forgotPassword,
   resetPassword,
   changePassword
};