import express from 'express';
import { createOrderController, getOrderByIdController, getUserOrdersController } from '../controllers/ecom/orderController';
import { orderValidationRules, idValidationRules } from '../middleware/validationMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import {authenticateToken }from '../middleware/authMiddleware';

const orderRouter = express.Router();

// Route for users to place orders
orderRouter.post('/', authenticateToken, orderValidationRules(), validateRequest, createOrderController);

// Routes for viewing orders
orderRouter.get('/me', authenticateToken, getUserOrdersController); // Users can view their own orders
orderRouter.get('/:id', authenticateToken, idValidationRules(), validateRequest, getOrderByIdController); 

export default orderRouter;
