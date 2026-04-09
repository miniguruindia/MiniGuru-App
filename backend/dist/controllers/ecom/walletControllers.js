"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllTransactions = void 0;
const wallet_1 = require("../../services/ecom/wallet"); // Import the service from wallet.ts
const logger_1 = __importDefault(require("../../logger"));
const error_1 = require("../../utils/error");
// Controller to fetch all transactions for a specific user
const getAllTransactions = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        // Call the service to get the user wallet (and transactions)
        const wallet = await (0, wallet_1.getUserWallet)(userId);
        if (!wallet) {
            throw new error_1.NotFoundError(`Wallet not found for user ID ${userId}`);
        }
        res.status(200).json(wallet);
        logger_1.default.info(`Fetched all transactions for user: ${userId}`);
    }
    catch (error) {
        if (error instanceof error_1.NotFoundError) {
            logger_1.default.warn(`Wallet not found for user ID ${userId}: ${error.message}`);
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }
        logger_1.default.error(`Error fetching transactions for user ${userId}: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve transactions. Please try again later.',
        });
    }
};
exports.getAllTransactions = getAllTransactions;
