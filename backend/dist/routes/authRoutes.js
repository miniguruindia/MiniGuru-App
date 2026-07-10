"use strict";
// /workspaces/MiniGuru-App/backend/src/routes/authRoutes.ts
// COMPLETE FILE - Replace entire file with this
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/auth/authController");
const passwordResetController_1 = require("../controllers/auth/passwordResetController");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const authMiddleware_1 = require("../middleware/authMiddleware");
const registrationController_1 = require("../controllers/auth/registrationController"); // ✅ CHANGED: Use authenticateToken instead of authenticateUser
const contactVerificationController_1 = require("../controllers/auth/contactVerificationController");
const authRouter = express_1.default.Router();
// ========================= AUTHENTICATION ROUTES =========================
/**
 * @route   POST /auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
authRouter.post('/login', authController_1.login);
/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
authRouter.post('/register', (0, validationMiddleware_1.registerValidationRules)(), authController_1.register);
/**
 * @route   POST /auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
authRouter.post('/refresh-token', authController_1.refreshToken);
/**
 * @route   POST /auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Public
 */
authRouter.post('/logout', authController_1.logout);
// ========================= PASSWORD MANAGEMENT =========================
/**
 * @route   POST /auth/forgot-password
 * @desc    Request password reset (generates temp password or reset token)
 * @access  Public
 */
authRouter.post('/forgot-password', passwordResetController_1.requestPasswordReset);
/**
 * @route   POST /auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 */
authRouter.post('/reset-password', passwordResetController_1.resetPassword);
/**
 * @route   POST /auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private (requires authentication)
 * ✅ FIXED: Use authenticateToken to verify JWT and populate req.user
 */
authRouter.post('/change-password', authMiddleware_1.authenticateToken, authController_1.changePassword);
/**
 * @route   POST /auth/change-login-id
 * @desc    Self-service MiniGuru ID change for the logged-in user
 * @access  Private (requires authentication + current password)
 */
authRouter.post('/change-login-id', authMiddleware_1.authenticateToken, authController_1.changeLoginId);
authRouter.post('/generate-id', registrationController_1.generateId);
authRouter.post('/send-otp', registrationController_1.sendOtp);
authRouter.post('/verify-otp', registrationController_1.verifyOtp);
// ========================= CONTACT VERIFICATION =========================
// On-demand, never blocking. Any account holder can request verification
// of their current email/phone whenever they want, and can change either
// contact at any time — a VERIFIED contact requires approval to change
// (OTP to the old contact, or manual admin approval), an UNVERIFIED one
// changes immediately. See contactVerificationController.ts for the design.
authRouter.post('/verification/send-otp', authMiddleware_1.authenticateToken, contactVerificationController_1.sendVerificationOtp);
authRouter.post('/verification/confirm-otp', authMiddleware_1.authenticateToken, contactVerificationController_1.confirmVerificationOtp);
authRouter.post('/verification/request-change', authMiddleware_1.authenticateToken, contactVerificationController_1.requestContactChange);
authRouter.post('/verification/confirm-change-otp', authMiddleware_1.authenticateToken, contactVerificationController_1.confirmContactChangeOtp);
exports.default = authRouter;
