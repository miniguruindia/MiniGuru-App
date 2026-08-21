// backend/src/routes/leaderboardRoutes.ts
// GET /leaderboard — top 10 users by score (Goins)
// Public endpoint — no auth needed
// Used by community_screen.dart Ladder tab

import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { getLevelForScore } from '../utils/levelSystem';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const topUsers = await prisma.user.findMany({
      where: {
        score: { gt: 0 },
        role: 'USER', // exclude admins from leaderboard
        isMentor: false, // exclude parents/schools/T-LABs — students only
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

    // BUGFIX (Aug 2026): this used to compute badge/level with its own
    // inline thresholds (600/300/100), disagreeing with at least 3 OTHER
    // hardcoded copies of "the level system" elsewhere in the codebase.
    // Now uses the one canonical getLevelForScore() everywhere.
    const leaderboard = topUsers.map((u, i) => {
      const lvl = getLevelForScore(u.score);
      return {
        rank:   i + 1,
        userId: u.id,
        name:   u.name,
        score:  u.score,
        badge:  lvl.emoji,
        level:  lvl.title,
        levelNumber: lvl.level,
      };
    });

    return res.json({ leaderboard });
  } catch (err: any) {
    console.error('leaderboard error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;