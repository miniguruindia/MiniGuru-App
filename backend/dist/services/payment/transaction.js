"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAndUpdateTransaction = exports.createRazorpayOrder = void 0;
const razorpayInstance_1 = __importDefault(require("./razorpayInstance"));
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const logger_1 = __importDefault(require("../../logger"));
const error_1 = require("../../utils/error");
const handleError = (error, context) => {
    logger_1.default.error(`${context}: ${error.message}`);
    throw error;
};
const createRazorpayOrder = async (amount, userId) => {
    // Check if Razorpay is configured
    if (!razorpayInstance_1.default) {
        throw new Error('Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
    }
    // Validate input
    if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
    }
    try {
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new error_1.NotFoundError('User not found');
        }
        const wallet = await prismaClient_1.default.wallet.findUnique({
            where: { userId },
            include: { transactions: true }
        });
        if (!wallet) {
            throw new error_1.NotFoundError('Wallet not found for the user');
        }
        const transaction = await prismaClient_1.default.transaction.create({
            data: {
                walletId: wallet.id,
                amount: amount,
                type: 'CREDIT',
                status: 'PENDING',
            },
        });
        const razorpayOrder = await razorpayInstance_1.default.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: transaction.id,
            notes: {
                userId: userId,
                name: user.name,
            },
        });
        logger_1.default.info(`Razorpay order created for user ${userId}: ${razorpayOrder.id}`);
        return {
            orderId: razorpayOrder.id,
            transactionId: transaction.id,
        };
    }
    catch (error) {
        handleError(error, `Error creating Razorpay order for user ${userId}`);
    }
};
exports.createRazorpayOrder = createRazorpayOrder;
const verifyAndUpdateTransaction = async (userId, transactionId, razorpayOrderId) => {
    // Check if Razorpay is configured
    if (!razorpayInstance_1.default) {
        throw new Error('Razorpay is not configured');
    }
    try {
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new error_1.NotFoundError('User not found');
        }
        const transaction = await prismaClient_1.default.transaction.findUnique({
            where: { id: transactionId },
            include: { wallet: true },
        });
        if (!transaction) {
            throw new error_1.NotFoundError('Transaction not found');
        }
        const razorpayOrder = await razorpayInstance_1.default.orders.fetch(razorpayOrderId);
        const { status, amount_paid, amount_due, currency } = razorpayOrder;
        if (status === 'paid') {
            const updatedWallet = await prismaClient_1.default.wallet.update({
                where: { id: transaction.walletId },
                data: {
                    balance: { increment: (amount_paid / 100) },
                },
            });
            await prismaClient_1.default.transaction.update({
                where: { id: transactionId },
                data: { status: 'COMPLETED' },
            });
            logger_1.default.info(`Payment verified and wallet updated for user ${userId}, transaction ${transactionId}`);
            return {
                success: true,
                message: `Payment completed successfully. Wallet balance updated.`,
                walletBalance: updatedWallet.balance,
            };
        }
        else if (status === 'attempted') {
            return {
                success: false,
                message: `Payment attempted but not completed yet. Amount due: ${amount_due} ${currency}`,
            };
        }
        else if (status === 'created') {
            return {
                success: false,
                message: `Payment has not been attempted. Order is still in created state.`,
            };
        }
        else {
            throw new Error(`Unknown order status: ${status}`);
        }
    }
    catch (error) {
        if (isRazorpayErrorResponse(error)) {
            const { code, description } = error.error;
            logger_1.default.error(`Razorpay error - ${code}: ${description}`);
            return {
                success: false,
                error: `${code}: ${description}`,
            };
        }
        logger_1.default.error(`Unexpected error: ${error.message}`);
        throw error;
    }
};
exports.verifyAndUpdateTransaction = verifyAndUpdateTransaction;
function isRazorpayErrorResponse(error) {
    return error.error !== undefined;
}
