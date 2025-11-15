import { Request, Response } from 'express';
import { createOrder, getOrderById, getUserOrders,getAllOrders } from '../../services/ecom/order';
import { NotFoundError, ServiceError } from '../../utils/error';
import logger from '../../logger';

// Utility function to handle sending error responses
const handleControllerError = (error: Error, res: Response,) => {
    if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
    }
    if (error instanceof ServiceError) {
        return res.status(400).json({ message: error.message });
    }

    logger.error(`Unexpected error: ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
};

// Create an order
export const createOrderController = async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { products, deliveryAddress } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: 'Products array is required and must contain at least one item.' });
    }

    try {
        const order = await createOrder({ userId, products, deliveryAddress });
        return res.status(201).json(order);
    } catch (error) {
        handleControllerError(error as Error, res);
    }
};

// Get order by ID
export const getOrderByIdController = async (req: Request, res: Response) => {
    const  userId  = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { orderId } = req.params;

    try {
        const order = await getOrderById(userId, orderId);
        if (!order) {
            return res.status(404).json({ message: `Order with ID ${orderId} not found.` });
        }
        return res.status(200).json(order);
    } catch (error) {
        handleControllerError(error as Error, res);
    }
};

// Get all orders for a user
export const getUserOrdersController = async (req: Request, res: Response) => {
    const  userId  = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const orders = await getUserOrders(userId);
        // if (!orders) {
        //     return res.status(404).json({ message: `No orders found for user ${userId}.` });
        // }
        return res.status(200).json(orders);
    } catch (error) {
        handleControllerError(error as Error, res);
    }
};

export const getAllOrdersController = async (req: Request, res: Response) => {
    const  userId  = req.user?.userId;
    if (!userId && req.user?.role!=="ADMIN") return res.status(401).json({ error: "Unauthorized" });
    try {
        const orders = await getAllOrders();
        return res.status(200).json(orders);
    } catch (error) {
        handleControllerError(error as Error, res);
    }
}
