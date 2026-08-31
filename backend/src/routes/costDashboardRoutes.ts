import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';
import { getCostDashboardSnapshot } from '../utils/costTracking';

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

export default router;
