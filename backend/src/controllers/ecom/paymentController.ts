import { Request, Response } from 'express';
import { createRazorpayOrder, verifyAndUpdateTransaction } from '../../services/payment/transaction';
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

export const createRazorpayOrderController = async (req: Request, res: Response) => {
    const { amount, userId} = req.body;

    try {

        // Validate input
        if (!amount || !userId ) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create Razorpay order
        const orderData = await createRazorpayOrder(amount, userId);

        return res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: orderData,
        });
    } catch (error) {
        logger.error(`Error in createOrderController: ${(error as Error).message}`);
        handleControllerError(error as Error,res)
    }
};

export const verifyRazorpayTransactionController = async (req: Request, res: Response) => {
    const { userId, transactionId, razorpayOrderId } = req.body;

    try {
        // Verify transaction and update status
        const result = await verifyAndUpdateTransaction(userId, transactionId, razorpayOrderId);

        return res.status(200).json({
            success: result.success,
            message: result.message,
            walletBalance: result.walletBalance,
        });
    } catch (error) {
        logger.error(`Error in verifyTransactionController: ${(error as Error).message}`);
        handleControllerError(error as Error,res)
    }
}
