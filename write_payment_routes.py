content = '''import express, { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/authMiddleware';
import prisma from '../utils/prismaClient';

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// POST /payment/create-order
// Flutter expects: 201 + { data: { orderId, transactionId } }
router.post('/create-order', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const userId = (req as any).user.id;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Minimum recharge is ₹1' });
    }

    const amountInPaise = Math.round(amount * 100);

    // Create Razorpay order
    const razorpayOrder = await (razorpay.orders.create as any)({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `mg_${Date.now()}`,
    });

    // Ensure user has a wallet
    const wallet = await prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });

    // Create a PENDING transaction — its ID becomes transactionId
    const transaction = await prisma.transaction.create({
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
  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /payment/verify-order
// Flutter sends: { userId, transactionId, razorpayOrderId }
// Flutter expects: { success: true } with status 200
router.post('/verify-order', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { transactionId, razorpayOrderId } = req.body;
    const userId = (req as any).user.id;

    // Find the pending transaction
    const transaction = await prisma.transaction.findUnique({
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
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'COMPLETED' },
      }),
      prisma.wallet.update({
        where: { id: transaction.walletId },
        data: { balance: { increment: transaction.amount } },
      }),
    ]);

    const updated = await prisma.wallet.findUnique({
      where: { id: transaction.walletId },
    });

    return res.status(200).json({
      success: true,
      newBalance: updated?.balance ?? 0,
    });
  } catch (err) {
    console.error('verify-order error:', err);
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

export default router;
'''

with open('/workspaces/MiniGuru-App/backend/src/routes/paymentRoutes.ts', 'w') as f:
    f.write(content)
print("paymentRoutes.ts written successfully")
