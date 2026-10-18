import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';
import { getCostDashboardSnapshot } from '../utils/costTracking';
import prisma from '../utils/prismaClient';

const router = Router();

router.use(authenticateToken, authorizeAdmin);

// GET /admin/cost-dashboard — live snapshot of every free-tier ceiling this
// project depends on. See costTracking.ts for what's a real live counter
// vs. a point-in-time check vs. a "check the GCP console" note.
router.get('/cost-dashboard', async (_req: Request, res: Response) => {
  try {
    const snapshot = await getCostDashboardSnapshot();
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: 'Could not load cost dashboard', detail: err?.message });
  }
});

// GET /admin/amazon-estimate — tentative Amazon earnings from materials lists
// emailed by children/schools. Estimate only: the real figure is in Amazon
// Associates. Commission % can be changed with AMAZON_EST_COMMISSION_PCT
// (default 2).
router.get('/amazon-estimate', async (_req: Request, res: Response) => {
  try {
    const pct = Number(process.env.AMAZON_EST_COMMISSION_PCT) > 0 ? Number(process.env.AMAZON_EST_COMMISSION_PCT) : 2;
    const rows = await prisma.listShare.findMany({
      select: { amazonValue: true, totalValue: true, itemCount: true, amazonItems: true, createdAt: true },
    });
    const now = Date.now();
    const blank = () => ({ lists: 0, amazonListValue: 0, allListValue: 0 });
    const out: any = { today: blank(), last30Days: blank(), allTime: blank() };
    const startOfIstDay = (() => {
      const ist = new Date(now + 5.5 * 3600 * 1000);
      ist.setUTCHours(0, 0, 0, 0);
      return ist.getTime() - 5.5 * 3600 * 1000;
    })();
    for (const r of rows) {
      const t = r.createdAt.getTime();
      const add = (b: any) => { b.lists += 1; b.amazonListValue += r.amazonValue; b.allListValue += r.totalValue; };
      add(out.allTime);
      if (now - t <= 30 * 86400000) add(out.last30Days);
      if (t >= startOfIstDay) add(out.today);
    }
    for (const k of ['today', 'last30Days', 'allTime']) {
      out[k].estimatedEarnings = Math.round(out[k].amazonListValue * pct) / 100;
    }
    out.commissionPct = pct;
    out.note = 'Tentative: ' + pct + '% of the Amazon part of every list emailed to a parent or school, using the shop price estimates. Not every list leads to a purchase, so the real figure is usually lower. Check Amazon Associates for actual earnings.';
    res.json(out);
  } catch (err: any) {
    res.status(500).json({ error: 'Could not load estimate', detail: err?.message });
  }
});

export default router;
