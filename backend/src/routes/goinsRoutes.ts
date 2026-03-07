// backend/src/routes/goinsRoutes.ts
// FIXED: Goins = user.score (virtual points)
//        Wallet = wallet.balance (real Razorpay money — never touched here)

import express from 'express';
import prisma from '../utils/prismaClient';
import logger from '../logger';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// ─── helpers ────────────────────────────────────────────────────────────────

async function getScore(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { score: true },
  });
  return user?.score ?? 0;
}

// ─── GET /goins/balance ──────────────────────────────────────────────────────
// Returns user.score — the virtual Goins balance
router.get('/balance', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const score  = await getScore(userId);
    return res.json({ balance: score });
  } catch (error) {
    logger.error(`GET /goins/balance error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch Goins balance.' });
  }
});

// ─── GET /goins/check?required=100 ──────────────────────────────────────────
router.get('/check', authenticateToken, async (req: any, res) => {
  try {
    const userId   = req.user?.userId;
    const required = parseInt(req.query.required as string) || 0;
    const balance  = await getScore(userId);
    return res.json({ sufficient: balance >= required, balance, required });
  } catch (error) {
    logger.error(`GET /goins/check error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to check Goins.' });
  }
});

// ─── GET /goins/history ──────────────────────────────────────────────────────
// Reads from GoinsTransaction table (separate from wallet transactions)
router.get('/history', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
    const score  = await getScore(userId);

    // Try to read from GoinsTransaction table if it exists
    let transactions: any[] = [];
    try {
      transactions = await (prisma as any).goinsTransaction.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      });
    } catch {
      // Table doesn't exist yet — return empty history (no crash)
      transactions = [];
    }

    return res.json({ transactions, balance: score });
  } catch (error) {
    logger.error(`GET /goins/history error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch Goins history.' });
  }
});

// ─── POST /goins/deduct ──────────────────────────────────────────────────────
// Deducts from user.score — called when materials are picked for a project
router.post('/deduct', authenticateToken, async (req: any, res) => {
  try {
    const userId    = req.user?.userId;
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

    const updated = await prisma.user.update({
      where: { id: userId },
      data:  { score: { decrement: totalGoins } },
      select: { score: true },
    });

    // Log to GoinsTransaction if table exists
    try {
      await (prisma as any).goinsTransaction.create({
        data: {
          userId,
          amount:      totalGoins,
          type:        'DEBIT',
          description: req.body.description ?? 'Materials deducted',
        },
      });
    } catch { /* table not yet migrated — silent */ }

    logger.info(`Goins deducted: -${totalGoins} for user ${userId}, new score: ${updated.score}`);
    return res.json({ success: true, deducted: totalGoins, newBalance: updated.score });
  } catch (error) {
    logger.error(`POST /goins/deduct error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to deduct Goins.' });
  }
});

// ─── POST /goins/award/video-upload ─────────────────────────────────────────
// Awards 50 Goins to user.score when a project video is uploaded
router.post('/award/video-upload', authenticateToken, async (req: any, res) => {
  try {
    const userId  = req.user?.userId;
    const awarded = 50;

    const updated = await prisma.user.update({
      where: { id: userId },
      data:  { score: { increment: awarded } },
      select: { score: true },
    });

    try {
      await (prisma as any).goinsTransaction.create({
        data: { userId, amount: awarded, type: 'CREDIT', description: 'Video uploaded' },
      });
    } catch { /* silent */ }

    logger.info(`Goins awarded for video upload: +${awarded} for user ${userId}`);
    return res.json({ success: true, awarded, newBalance: updated.score });
  } catch (error) {
    logger.error(`POST /goins/award/video-upload error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to award Goins.' });
  }
});

// ─── POST /goins/award/like ──────────────────────────────────────────────────
router.post('/award/like', authenticateToken, async (req: any, res) => {
  try {
    const userId  = req.user?.userId;
    const awarded = 5;

    const updated = await prisma.user.update({
      where: { id: userId },
      data:  { score: { increment: awarded } },
      select: { score: true },
    });

    try {
      await (prisma as any).goinsTransaction.create({
        data: { userId, amount: awarded, type: 'CREDIT', description: 'Received a like' },
      });
    } catch { /* silent */ }

    return res.json({ success: true, awarded, newBalance: updated.score });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to award Goins for like.' });
  }
});

// ─── POST /goins/award/comment ───────────────────────────────────────────────
router.post('/award/comment', authenticateToken, async (req: any, res) => {
  try {
    const userId  = req.user?.userId;
    const awarded = 10;

    const updated = await prisma.user.update({
      where: { id: userId },
      data:  { score: { increment: awarded } },
      select: { score: true },
    });

    try {
      await (prisma as any).goinsTransaction.create({
        data: { userId, amount: awarded, type: 'CREDIT', description: 'Posted a comment' },
      });
    } catch { /* silent */ }

    return res.json({ success: true, awarded, newBalance: updated.score });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to award Goins for comment.' });
  }
});

export default router;