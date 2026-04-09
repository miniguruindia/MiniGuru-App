"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWallet = exports.getUserTransactions = exports.addWalletBalance = exports.deductWalletBalance = exports.getUserWallet = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../../logger"));
const error_1 = require("../../utils/error"); // Import the NotFoundError
// Utility function to log and rethrow errors
const handleError = (error, context) => {
    logger_1.default.error(`${context}: ${error.message}`);
    throw error;
};
const getUserWallet = async (userId) => {
    try {
        // findUniqueOrThrow guarantees the wallet is not undefined
        const wallet = await prismaClient_1.default.wallet.findUniqueOrThrow({
            where: { userId: userId },
            include: { transactions: true },
        });
        return wallet;
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            logger_1.default.warn(`Wallet not found for user ID ${userId}`);
            throw new error_1.NotFoundError(`Wallet not found for user ID ${userId}`); // Use NotFoundError
        }
        handleError(error, `Error fetching wallet for user ${userId}`);
    }
};
exports.getUserWallet = getUserWallet;
const deductWalletBalance = async (userId, amount) => {
    try {
        const wallet = await (0, exports.getUserWallet)(userId);
        if (!wallet || wallet.balance < amount) {
            throw new Error('Insufficient wallet balance');
        }
        const transactionResult = await prismaClient_1.default.$transaction(async (prisma) => {
            // Create a transaction record with a PENDING status
            const transaction = await prisma.transaction.create({
                data: {
                    walletId: wallet.id,
                    amount,
                    type: 'DEBIT',
                    status: client_1.PaymentStatus.PENDING,
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
                data: { status: client_1.PaymentStatus.COMPLETED },
            });
            return transaction;
        });
        return transactionResult;
    }
    catch (error) {
        handleError(error, `Error deducting wallet balance for user ${userId}`);
    }
};
exports.deductWalletBalance = deductWalletBalance;
const addWalletBalance = async (userId, amount) => {
    try {
        const transactionResult = await prismaClient_1.default.$transaction(async (prisma) => {
            // Create a transaction record with a PENDING status
            const transaction = await prisma.transaction.create({
                data: {
                    walletId: (await (0, exports.getUserWallet)(userId)).id,
                    amount,
                    type: 'CREDIT',
                    status: client_1.PaymentStatus.PENDING,
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
                data: { status: client_1.PaymentStatus.COMPLETED },
            });
            return transaction;
        });
        return transactionResult;
    }
    catch (error) {
        handleError(error, `Error adding wallet balance for user ${userId}`);
    }
};
exports.addWalletBalance = addWalletBalance;
const getUserTransactions = async (userId) => {
    try {
        const wallet = await (0, exports.getUserWallet)(userId);
        return wallet.transactions;
    }
    catch (error) {
        handleError(error, `Error fetching transactions for user ${userId}`);
    }
};
exports.getUserTransactions = getUserTransactions;
const createWallet = async (userId) => {
    try {
        const existingWallet = await prismaClient_1.default.wallet.findUnique({
            where: { userId },
        });
        if (existingWallet) {
            throw new Error('Wallet already exists for the user');
        }
        const wallet = await prismaClient_1.default.wallet.create({
            data: {
                user: { connect: { id: userId } },
                balance: 0.0,
            },
        });
        logger_1.default.info(`Wallet created for user: ${userId}`);
        return wallet;
    }
    catch (error) {
        handleError(error, `Error creating wallet for user ${userId}`);
    }
};
exports.createWallet = createWallet;
