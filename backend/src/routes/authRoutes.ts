import express from 'express';
import { login, refreshToken, logout, register } from '../controllers/auth/authController';
import { requestPasswordReset, resetPassword } from '../controllers/auth/passwordResetController';
import { registerValidationRules } from '../middleware/validationMiddleware';

const authRouter = express.Router();

// Auth routes
authRouter.post('/login', login);
authRouter.post('/refresh-token', refreshToken);
authRouter.post('/logout', logout);
authRouter.post('/register', registerValidationRules(), register);

// Password reset routes
authRouter.post('/request-password-reset', requestPasswordReset);
authRouter.post('/reset-password', resetPassword);

export default authRouter;
