// backend/src/routes/leaderboardRoutes.ts
// GET /leaderboard — top 10 users by score (Goins)
// Public endpoint — no auth needed
// Used by community_screen.dart Ladder tab

import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const topUsers = await prisma.user.findMany({
      where: {
        score: { gt: 0 },
      },
      orderBy: { score: 'desc' },
      take: 10,
      select: {
        id:           true,
        name:         true,
        score:        true,
        profilePhoto: true,
      },
    });

    const leaderboard = topUsers.map((u, i) => ({
      rank:   i + 1,
      userId: u.id,
      name:   u.name,
      score:  u.score,
      badge:  u.score >= 1000 ? '🚀' :
              u.score >= 600  ? '🔬' :
              u.score >= 300  ? '⚙️' :
              u.score >= 100  ? '🔩' : '🌱',
      level:  u.score >= 1000 ? 'Innovator' :
              u.score >= 600  ? 'Inventor'  :
              u.score >= 300  ? 'Builder'   :
              u.score >= 100  ? 'Tinkerer'  : 'Sprout',
    }));

    return res.json({ leaderboard });
  } catch (err: any) {
    console.error('leaderboard error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;