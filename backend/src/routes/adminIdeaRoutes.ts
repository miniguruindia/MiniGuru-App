// Admin "Ideas" list (Nov 2026). Mounted at /admin. Ideas are not reviewed; admin can only hide or show one.
import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticateToken, authorizeAdmin);
const db: any = prisma;

router.get('/ideas', async (_req: Request, res: Response) => {
  try {
    const rows = await db.idea.findMany({
      orderBy: { createdAt: 'desc' }, take: 300,
      select: { id: true, code: true, title: true, description: true, makerName: true, status: true, tries: true, createdAt: true },
    });
    return res.json({ ideas: rows });
  } catch { return res.status(500).json({ error: 'Could not load ideas.' }); }
});

router.post('/ideas/:id/status', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const status = req.body?.status === 'hidden' ? 'hidden' : 'visible';
    if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(400).json({ error: 'Bad id' });
    await db.idea.update({ where: { id }, data: { status } });
    return res.json({ ok: true, status });
  } catch { return res.status(500).json({ error: 'Could not change it.' }); }
});

export default router;
