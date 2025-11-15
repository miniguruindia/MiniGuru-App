import { razorpayInstance } from "./razorpayInstance";
import prisma from "../../utils/prismaClient";
import logger from '../../logger';
import { NotFoundError } from "../../utils/error";

const handleError = (error: Error, context: string): never => {
    logger.error(`${context}: ${error.message}`);
    throw error;
};
export const createRazorpayOrder = async (
    amount: number,
    userId: string,
) => {
    // Validate input
    if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
    }

    try {

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new NotFoundError('User not found');
        }
        // Fetch the user's wallet
        const wallet = await prisma.wallet.findUnique({
            where: { userId },
            include: { transactions: true }
        });

        if (!wallet) {
            throw new NotFoundError('Wallet not found for the user');
        }

        // Create a new transaction with PENDING status
        const transaction = await prisma.transaction.create({
            data: {
                walletId: wallet.id,
                amount: amount,
                type: 'CREDIT',
                status: 'PENDING',

            },
        });

        // Use the transaction ID as the receipt in Razorpay
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: amount * 100, // Convert to smallest sub-unit (paise for INR)
            currency: "INR",
            receipt: transaction.id, // Use transaction ID as receipt
            notes: {
                userId: userId,
                name: user.name,
            },
        });

        // Log successful order creation
        logger.info(`Razorpay order created for user ${userId}: ${razorpayOrder.id}`);

        // Return the order ID and transaction details
        return {
            orderId: razorpayOrder.id,
            transactionId: transaction.id,
        };
    } catch (error) {
        handleError(error as Error, `Error creating Razorpay order for user ${userId}`);
    }
};


interface RazorpayErrorResponse {
    error: {
        code: string;
        description: string;
        source: string;
        step: string;
        reason: string;
        metadata: Record<string, unknown>;
    };
}

export const verifyAndUpdateTransaction = async (
    userId: string,
    transactionId: string,
    razorpayOrderId: string
) => {
    try {
        // Fetch the transaction to ensure it exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new NotFoundError('User not found');
        }
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { wallet: true },
        });

        if (!transaction) {
            throw new NotFoundError('Transaction not found');
        }

        // Fetch the Razorpay order details
        const razorpayOrder = await razorpayInstance.orders.fetch(razorpayOrderId);

        // Check the order status
        const { status, amount_paid, amount_due, currency } = razorpayOrder;

        if (status === 'paid') {
            // Payment is successful, update the user's wallet balance
            const updatedWallet = await prisma.wallet.update({
                where: { id: transaction.walletId },
                data: {
                    balance: { increment: (amount_paid/100) }, // Add the amount to the user's wallet
                },
            });

            // Update the transaction status to COMPLETED
            await prisma.transaction.update({
                where: { id: transactionId },
                data: { status: 'COMPLETED' },
            });

            logger.info(`Payment verified and wallet updated for user ${userId}, transaction ${transactionId}`);
            return {
                success: true,
                message: `Payment completed successfully. Wallet balance updated.`,
                walletBalance: updatedWallet.balance,
            };
        } else if (status === 'attempted') {
            // Payment is attempted but not yet completed
            return {
                success: false,
                message: `Payment attempted but not completed yet. Amount due: ${amount_due} ${currency}`,
            };
        } else if (status === 'created') {
            // Payment has not been attempted yet
            return {
                success: false,
                message: `Payment has not been attempted. Order is still in created state.`,
            };
        } else {
            throw new Error(`Unknown order status: ${status}`);
        }
    } catch (error: unknown) {
        if (isRazorpayErrorResponse(error)) {
            const { code, description } = error.error;
            logger.error(`Razorpay error - ${code}: ${description}`);
            return {
                success: false,
                error: `${code}: ${description}`,
            };
        }

        logger.error(`Unexpected error: ${(error as Error).message}`);
        throw error;
    }
};

// Helper type guard to check if error is RazorpayErrorResponse
function isRazorpayErrorResponse(error: unknown): error is RazorpayErrorResponse {
    return (error as RazorpayErrorResponse).error !== undefined;
}
