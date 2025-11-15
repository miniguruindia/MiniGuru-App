import prisma from '../../utils/prismaClient';
import { Prisma, PaymentStatus } from '@prisma/client';
import logger from '../../logger';
import { NotFoundError } from '../../utils/error'; // Import the NotFoundError

// Utility function to log and rethrow errors
const handleError = (error: Error, context: string): never => {
    logger.error(`${context}: ${error.message}`);
    throw error;
};

export const getUserWallet = async (userId: string) => {
    try {
        // findUniqueOrThrow guarantees the wallet is not undefined
        const wallet = await prisma.wallet.findUniqueOrThrow({
            where: { userId:userId },
            include: { transactions: true },
        });
        return wallet;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            logger.warn(`Wallet not found for user ID ${userId}`);
            throw new NotFoundError(`Wallet not found for user ID ${userId}`); // Use NotFoundError
        }
        handleError(error as Error, `Error fetching wallet for user ${userId}`);
    }
};

export const deductWalletBalance = async (userId: string, amount: number) => {
    try {
        const wallet = await getUserWallet(userId);
        if (!wallet || wallet.balance < amount) {
            throw new Error('Insufficient wallet balance');
        }

        const transactionResult = await prisma.$transaction(async (prisma) => {
            // Create a transaction record with a PENDING status
            const transaction = await prisma.transaction.create({
                data: {
                    walletId: wallet.id,
                    amount,
                    type: 'DEBIT',
                    status: PaymentStatus.PENDING,
                },
            });

            // Update wallet balance
            await prisma.wallet.update({
                where: { userId },
                data: {
                    balance: { decrement: amount },
                },
            });

            // Update the transaction status to COMPLETED upon successful deduction
            await prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: PaymentStatus.COMPLETED },
            });

            return transaction;
        });

        return transactionResult;
    } catch (error) {
        handleError(error as Error, `Error deducting wallet balance for user ${userId}`);
        
    }
};

export const addWalletBalance = async (userId: string, amount: number) => {
    try {
        const transactionResult = await prisma.$transaction(async (prisma) => {
            // Create a transaction record with a PENDING status
            const transaction = await prisma.transaction.create({
                data: {
                    walletId: (await getUserWallet(userId))!.id,
                    amount,
                    type: 'CREDIT',
                    status: PaymentStatus.PENDING,
                },
            });

            // Update wallet balance
            await prisma.wallet.update({
                where: { userId },
                data: {
                    balance: { increment: amount },
                },
            });

            // Update the transaction status to COMPLETED upon successful addition
            await prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: PaymentStatus.COMPLETED },
            });

            return transaction;
        });

        return transactionResult;
    } catch (error) {
        handleError(error as Error, `Error adding wallet balance for user ${userId}`);
    }
};

export const getUserTransactions = async (userId: string) => {
    try {
        const wallet = await getUserWallet(userId);
        return wallet!.transactions;
    } catch (error) {
        handleError(error as Error, `Error fetching transactions for user ${userId}`);
    }
};

export const createWallet = async (userId: string) => {
    try {
        const existingWallet = await prisma.wallet.findUnique({
            where: { userId },
        });

        if (existingWallet) {
            throw new Error('Wallet already exists for the user');
        }

        const wallet = await prisma.wallet.create({
            data: {
                user: { connect: { id: userId } },
                balance: 0.0,
            },
        });

        logger.info(`Wallet created for user: ${userId}`);
        return wallet;
    } catch (error) {
        handleError(error as Error, `Error creating wallet for user ${userId}`);
    }
};
