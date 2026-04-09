"use strict";
// backend/src/routes/goinsRoutes.ts
// FIXED: Goins = user.score (virtual points)
//        Wallet = wallet.balance (real Razorpay money — never touched here)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const logger_1 = __importDefault(require("../logger"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const resolveSubject_1 = require("../middleware/resolveSubject");
const router = express_1.default.Router();
// ─── helpers ────────────────────────────────────────────────────────────────
async function getScore(userId) {
    const user = await prismaClient_1.default.user.findUnique({
        where: { id: userId },
        select: { score: true },
    });
    return user?.score ?? 0;
}
// ─── GET /goins/balance ──────────────────────────────────────────────────────
// Returns user.score — the virtual Goins balance
router.get('/balance', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const score = await getScore(userId);
        return res.json({ balance: score });
    }
    catch (error) {
        logger_1.default.error(`GET /goins/balance error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to fetch Goins balance.' });
    }
});
// ─── GET /goins/check?required=100 ──────────────────────────────────────────
router.get('/check', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const required = parseInt(req.query.required) || 0;
        const balance = await getScore(userId);
        return res.json({ sufficient: balance >= required, balance, required });
    }
    catch (error) {
        logger_1.default.error(`GET /goins/check error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to check Goins.' });
    }
});
// ─── GET /goins/history ──────────────────────────────────────────────────────
// Reads from GoinsTransaction table (separate from wallet transactions)
router.get('/history', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const score = await getScore(userId);
        // Try to read from GoinsTransaction table if it exists
        let transactions = [];
        try {
            transactions = await prismaClient_1.default.goinsTransaction.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            });
        }
        catch {
            // Table doesn't exist yet — return empty history (no crash)
            transactions = [];
        }
        return res.json({ transactions, balance: score });
    }
    catch (error) {
        logger_1.default.error(`GET /goins/history error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to fetch Goins history.' });
    }
});
// ─── POST /goins/deduct ──────────────────────────────────────────────────────
// Deducts from user.score — called when materials are picked for a project
router.post('/deduct', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { totalGoins } = req.body;
        if (!totalGoins || totalGoins <= 0) {
            return res.status(400).json({ message: 'Invalid Goins amount.' });
        }
        const current = await getScore(userId);
        if (current < totalGoins) {
            return res.status(400).json({
                message: 'Insufficient Goins balance.',
                balance: current,
            });
        }
        const updated = await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { score: { decrement: totalGoins } },
            select: { score: true },
        });
        // Log to GoinsTransaction if table exists
        try {
            await prismaClient_1.default.goinsTransaction.create({
                data: {
                    userId,
                    amount: totalGoins,
                    type: 'DEBIT',
                    description: req.body.description ?? 'Materials deducted',
                },
            });
        }
        catch { /* table not yet migrated — silent */ }
        logger_1.default.info(`Goins deducted: -${totalGoins} for user ${userId}, new score: ${updated.score}`);
        return res.json({ success: true, deducted: totalGoins, newBalance: updated.score });
    }
    catch (error) {
        logger_1.default.error(`POST /goins/deduct error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to deduct Goins.' });
    }
});
// ─── POST /goins/award/video-upload ─────────────────────────────────────────
// Awards 50 Goins to user.score when a project video is uploaded
router.post('/award/video-upload', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const awarded = 50;
        const updated = await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { score: { increment: awarded } },
            select: { score: true },
        });
        try {
            await prismaClient_1.default.goinsTransaction.create({
                data: { userId, amount: awarded, type: 'CREDIT', description: 'Video uploaded' },
            });
        }
        catch { /* silent */ }
        logger_1.default.info(`Goins awarded for video upload: +${awarded} for user ${userId}`);
        return res.json({ success: true, awarded, newBalance: updated.score });
    }
    catch (error) {
        logger_1.default.error(`POST /goins/award/video-upload error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to award Goins.' });
    }
});
// ─── POST /goins/award/like ──────────────────────────────────────────────────
router.post('/award/like', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const awarded = 5;
        const updated = await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { score: { increment: awarded } },
            select: { score: true },
        });
        try {
            await prismaClient_1.default.goinsTransaction.create({
                data: { userId, amount: awarded, type: 'CREDIT', description: 'Received a like' },
            });
        }
        catch { /* silent */ }
        return res.json({ success: true, awarded, newBalance: updated.score });
    }
    catch (error) {
        return res.status(500).json({ message: 'Failed to award Goins for like.' });
    }
});
// ─── POST /goins/award/comment ───────────────────────────────────────────────
router.post('/award/comment', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const awarded = 10;
        const updated = await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { score: { increment: awarded } },
            select: { score: true },
        });
        try {
            await prismaClient_1.default.goinsTransaction.create({
                data: { userId, amount: awarded, type: 'CREDIT', description: 'Posted a comment' },
            });
        }
        catch { /* silent */ }
        return res.json({ success: true, awarded, newBalance: updated.score });
    }
    catch (error) {
        return res.status(500).json({ message: 'Failed to award Goins for comment.' });
    }
});
exports.default = router;
