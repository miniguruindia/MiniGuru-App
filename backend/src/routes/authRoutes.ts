// /workspaces/MiniGuru-App/backend/src/routes/authRoutes.ts
// COMPLETE FILE - Replace entire file with this

import express from 'express';
import { login, refreshToken, logout, register, changePassword } from '../controllers/auth/authController';
import { requestPasswordReset, resetPassword } from '../controllers/auth/passwordResetController';
import { registerValidationRules } from '../middleware/validationMiddleware';
import { authenticateToken } from '../middleware/authMiddleware'; // ✅ CHANGED: Use authenticateToken instead of authenticateUser

const authRouter = express.Router();

// ========================= AUTHENTICATION ROUTES =========================

/**
 * @route   POST /auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
authRouter.post('/login', login);

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
authRouter.post('/register', registerValidationRules(), register);

/**
 * @route   POST /auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
authRouter.post('/refresh-token', refreshToken);

/**
 * @route   POST /auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Public
 */
authRouter.post('/logout', logout);

// ========================= PASSWORD MANAGEMENT =========================

/**
 * @route   POST /auth/forgot-password
 * @desc    Request password reset (generates temp password or reset token)
 * @access  Public
 */
authRouter.post('/forgot-password', requestPasswordReset);

/**
 * @route   POST /auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 */
authRouter.post('/reset-password', resetPassword);

/**
 * @route   POST /auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private (requires authentication)
 * ✅ FIXED: Use authenticateToken to verify JWT and populate req.user
 */
authRouter.post('/change-password', authenticateToken, changePassword);

export default authRouter;