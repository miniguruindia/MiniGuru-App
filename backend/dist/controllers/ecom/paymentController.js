"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRazorpayTransactionController = exports.createRazorpayOrderController = void 0;
const transaction_1 = require("../../services/payment/transaction");
const error_1 = require("../../utils/error");
const logger_1 = __importDefault(require("../../logger"));
// Utility function to handle sending error responses
const handleControllerError = (error, res) => {
    if (error instanceof error_1.NotFoundError) {
        return res.status(404).json({ message: error.message });
    }
    if (error instanceof error_1.ServiceError) {
        return res.status(400).json({ message: error.message });
    }
    logger_1.default.error(`Unexpected error: ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
};
const createRazorpayOrderController = async (req, res) => {
    const { amount, userId } = req.body;
    try {
        // Validate input
        if (!amount || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Create Razorpay order
        const orderData = await (0, transaction_1.createRazorpayOrder)(amount, userId);
        return res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: orderData,
        });
    }
    catch (error) {
        logger_1.default.error(`Error in createOrderController: ${error.message}`);
        handleControllerError(error, res);
    }
};
exports.createRazorpayOrderController = createRazorpayOrderController;
const verifyRazorpayTransactionController = async (req, res) => {
    const { userId, transactionId, razorpayOrderId } = req.body;
    try {
        // Verify transaction and update status
        const result = await (0, transaction_1.verifyAndUpdateTransaction)(userId, transactionId, razorpayOrderId);
        return res.status(200).json({
            success: result.success,
            message: result.message,
            walletBalance: result.walletBalance,
        });
    }
    catch (error) {
        logger_1.default.error(`Error in verifyTransactionController: ${error.message}`);
        handleControllerError(error, res);
    }
};
exports.verifyRazorpayTransactionController = verifyRazorpayTransactionController;
