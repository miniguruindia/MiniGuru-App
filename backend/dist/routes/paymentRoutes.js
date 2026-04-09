"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const razorpay_1 = __importDefault(require("razorpay"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const router = express_1.default.Router();
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
// POST /payment/create-order
// Flutter expects: 201 + { data: { orderId, transactionId } }
router.post('/create-order', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id;
        if (!amount || amount < 1) {
            return res.status(400).json({ error: 'Minimum recharge is ₹1' });
        }
        const amountInPaise = Math.round(amount * 100);
        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `mg_${Date.now()}`,
        });
        // Ensure user has a wallet
        const wallet = await prismaClient_1.default.wallet.upsert({
            where: { userId },
            create: { userId, balance: 0 },
            update: {},
        });
        // Create a PENDING transaction — its ID becomes transactionId
        const transaction = await prismaClient_1.default.transaction.create({
            data: {
                walletId: wallet.id,
                amount: amount,
                type: 'CREDIT',
                status: 'PENDING',
            },
        });
        return res.status(201).json({
            data: {
                orderId: razorpayOrder.id,
                transactionId: transaction.id,
            },
        });
    }
    catch (err) {
        console.error('create-order error:', err);
        return res.status(500).json({ error: 'Failed to create payment order' });
    }
});
// POST /payment/verify-order
// Flutter sends: { userId, transactionId, razorpayOrderId }
// Flutter expects: { success: true } with status 200
router.post('/verify-order', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { transactionId, razorpayOrderId } = req.body;
        const userId = req.user.id;
        // Find the pending transaction
        const transaction = await prismaClient_1.default.transaction.findUnique({
            where: { id: transactionId },
            include: { wallet: true },
        });
        if (!transaction) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }
        if (transaction.wallet.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }
        // Mark transaction as COMPLETED and credit wallet
        await prismaClient_1.default.$transaction([
            prismaClient_1.default.transaction.update({
                where: { id: transactionId },
                data: { status: 'COMPLETED' },
            }),
            prismaClient_1.default.wallet.update({
                where: { id: transaction.walletId },
                data: { balance: { increment: transaction.amount } },
            }),
        ]);
        const updated = await prismaClient_1.default.wallet.findUnique({
            where: { id: transaction.walletId },
        });
        return res.status(200).json({
            success: true,
            newBalance: updated?.balance ?? 0,
        });
    }
    catch (err) {
        console.error('verify-order error:', err);
        return res.status(500).json({ success: false, error: 'Verification failed' });
    }
});
exports.default = router;
