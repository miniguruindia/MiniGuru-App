import razorpayInstance from "./razorpayInstance";
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
    // Check if Razorpay is configured
    if (!razorpayInstance) {
        throw new Error('Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
    }

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

        const wallet = await prisma.wallet.findUnique({
            where: { userId },
            include: { transactions: true }
        });

        if (!wallet) {
            throw new NotFoundError('Wallet not found for the user');
        }

        const transaction = await prisma.transaction.create({
            data: {
                walletId: wallet.id,
                amount: amount,
                type: 'CREDIT',
                status: 'PENDING',
            },
        });

        const razorpayOrder = await razorpayInstance.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: transaction.id,
            notes: {
                userId: userId,
                name: user.name,
            },
        });

        logger.info(`Razorpay order created for user ${userId}: ${razorpayOrder.id}`);

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
    // Check if Razorpay is configured
    if (!razorpayInstance) {
        throw new Error('Razorpay is not configured');
    }

    try {
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

        const razorpayOrder = await razorpayInstance.orders.fetch(razorpayOrderId);

        const { status, amount_paid, amount_due, currency } = razorpayOrder;

        if (status === 'paid') {
            const updatedWallet = await prisma.wallet.update({
                where: { id: transaction.walletId },
                data: {
                    balance: { increment: (amount_paid/100) },
                },
            });

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
            return {
                success: false,
                message: `Payment attempted but not completed yet. Amount due: ${amount_due} ${currency}`,
            };
        } else if (status === 'created') {
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

function isRazorpayErrorResponse(error: unknown): error is RazorpayErrorResponse {
    return (error as RazorpayErrorResponse).error !== undefined;
}