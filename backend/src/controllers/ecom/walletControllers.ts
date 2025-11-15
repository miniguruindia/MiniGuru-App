import { Request, Response } from 'express';
import { getUserWallet } from '../../services/ecom/wallet'; // Import the service from wallet.ts
import logger from '../../logger';
import { NotFoundError } from '../../utils/error';


// Controller to fetch all transactions for a specific user
export const getAllTransactions = async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        // Call the service to get the user wallet (and transactions)
        const wallet = await getUserWallet(userId);
        

        if (!wallet) {
            throw new NotFoundError(`Wallet not found for user ID ${userId}`);
        }

        res.status(200).json(wallet);
        logger.info(`Fetched all transactions for user: ${userId}`);
    } catch (error) {
        if (error instanceof NotFoundError) {
            logger.warn(`Wallet not found for user ID ${userId}: ${error.message}`);
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }

        logger.error(`Error fetching transactions for user ${userId}: ${(error as Error).message}`);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve transactions. Please try again later.',
        });
    }
};
