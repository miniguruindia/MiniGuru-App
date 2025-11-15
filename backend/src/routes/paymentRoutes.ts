import express from "express";
import { createRazorpayOrderController, verifyRazorpayTransactionController } from "../controllers/ecom/paymentController";
import { createRazorPayOrderValidation, verifyRazorpayTransactionValidation } from "../middleware/validationMiddleware";
import {authenticateToken }from '../middleware/authMiddleware';
import { validateRequest } from "../middleware/validateRequest";

export const paymentRouter = express.Router();
paymentRouter.post('/create-order',authenticateToken,createRazorPayOrderValidation,validateRequest, createRazorpayOrderController);
paymentRouter.post('/verify-order',authenticateToken,verifyRazorpayTransactionValidation,validateRequest, verifyRazorpayTransactionController);