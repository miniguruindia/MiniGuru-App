import express from 'express';
import { login, refreshToken, logout, register } from '../controllers/auth/authController';
import { registerValidationRules } from '../middleware/validationMiddleware';

const authRouter = express.Router();

authRouter.post('/login', login);
authRouter.post('/refresh-token', refreshToken);
authRouter.post('/logout', logout);
authRouter.post('/register', registerValidationRules(),register)

export default authRouter;
