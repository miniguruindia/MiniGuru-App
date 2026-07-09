// /workspaces/MiniGuru-App/backend/src/routes/authRoutes.ts
// COMPLETE FILE - Replace entire file with this

import express from 'express';
import { login, refreshToken, logout, register, changePassword, changeLoginId } from '../controllers/auth/authController';
import { requestPasswordReset, resetPassword } from '../controllers/auth/passwordResetController';
import { registerValidationRules } from '../middleware/validationMiddleware';
import { authenticateToken } from '../middleware/authMiddleware';
import { generateId, sendOtp, verifyOtp } from '../controllers/auth/registrationController'; // ✅ CHANGED: Use authenticateToken instead of authenticateUser
import {
  sendVerificationOtp,
  confirmVerificationOtp,
  requestContactChange,
  confirmContactChangeOtp,
} from '../controllers/auth/contactVerificationController';

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

/**
 * @route   POST /auth/change-login-id
 * @desc    Self-service MiniGuru ID change for the logged-in user
 * @access  Private (requires authentication + current password)
 */
authRouter.post('/change-login-id', authenticateToken, changeLoginId);

authRouter.post('/generate-id', generateId);
authRouter.post('/send-otp', sendOtp);
authRouter.post('/verify-otp', verifyOtp);

// ========================= CONTACT VERIFICATION =========================
// On-demand, never blocking. Any account holder can request verification
// of their current email/phone whenever they want, and can change either
// contact at any time — a VERIFIED contact requires approval to change
// (OTP to the old contact, or manual admin approval), an UNVERIFIED one
// changes immediately. See contactVerificationController.ts for the design.

authRouter.post('/verification/send-otp', authenticateToken, sendVerificationOtp);
authRouter.post('/verification/confirm-otp', authenticateToken, confirmVerificationOtp);
authRouter.post('/verification/request-change', authenticateToken, requestContactChange);
authRouter.post('/verification/confirm-change-otp', authenticateToken, confirmContactChangeOtp);

export default authRouter;