import express from 'express';
import prisma from '../utils/prismaClient';
import logger from '../logger';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// GET /goins/balance
router.get('/balance', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    return res.json({
      balance: wallet?.balance ?? 0,
      recentTransactions: wallet?.transactions ?? [],
    });
  } catch (error) {
    logger.error(`GET /goins/balance error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch Goins balance.' });
  }
});

// GET /goins/check?required=100
router.get('/check', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const required = parseInt(req.query.required as string) || 0;
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const balance = wallet?.balance ?? 0;
    return res.json({ sufficient: balance >= required, balance, required });
  } catch (error) {
    logger.error(`GET /goins/check error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to check Goins.' });
  }
});

// GET /goins/history
router.get('/history', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.json({ transactions: [], balance: 0 });
    const transactions = await prisma.transaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return res.json({ transactions, balance: wallet.balance });
  } catch (error) {
    logger.error(`GET /goins/history error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch Goins history.' });
  }
});

// POST /goins/deduct
router.post('/deduct', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const { totalGoins } = req.body;
    if (!totalGoins || totalGoins <= 0) {
      return res.status(400).json({ message: 'Invalid Goins amount.' });
    }
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found.' });
    if (wallet.balance < totalGoins) {
      return res.status(400).json({ message: 'Insufficient Goins balance.', balance: wallet.balance });
    }
    const [updated] = await prisma.$transaction([
      prisma.wallet.update({
        where: { userId },
        data: { balance: { decrement: totalGoins } },
      }),
      prisma.transaction.create({
        data: { walletId: wallet.id, amount: totalGoins, type: 'DEBIT', status: 'COMPLETED' },
      }),
    ]);
    logger.info(`Goins deducted: -${totalGoins} for user ${userId}`);
    return res.json({ success: true, deducted: totalGoins, newBalance: updated.balance });
  } catch (error) {
    logger.error(`POST /goins/deduct error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to deduct Goins.' });
  }
});

// POST /goins/award/video-upload
router.post('/award/video-upload', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const awarded = 50;
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found.' });
    const [updated] = await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { increment: awarded } } }),
      prisma.transaction.create({
        data: { walletId: wallet.id, amount: awarded, type: 'CREDIT', status: 'COMPLETED' },
      }),
    ]);
    logger.info(`Goins awarded for video upload: +${awarded} for user ${userId}`);
    return res.json({ success: true, awarded, newBalance: updated.balance });
  } catch (error) {
    logger.error(`POST /goins/award/video-upload error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to award Goins.' });
  }
});

// POST /goins/award/like
router.post('/award/like', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const awarded = 5;
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found.' });
    const [updated] = await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { increment: awarded } } }),
      prisma.transaction.create({
        data: { walletId: wallet.id, amount: awarded, type: 'CREDIT', status: 'COMPLETED' },
      }),
    ]);
    return res.json({ success: true, awarded, newBalance: updated.balance });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to award Goins for like.' });
  }
});

// POST /goins/award/comment
router.post('/award/comment', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const awarded = 10;
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found.' });
    const [updated] = await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { increment: awarded } } }),
      prisma.transaction.create({
        data: { walletId: wallet.id, amount: awarded, type: 'CREDIT', status: 'COMPLETED' },
      }),
    ]);
    return res.json({ success: true, awarded, newBalance: updated.balance });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to award Goins for comment.' });
  }
});

export default router;