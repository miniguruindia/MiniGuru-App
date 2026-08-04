// backend/src/routes/dailyQuestRoutes.ts
// GET /goins/daily-quest — today's real Daily Quest progress + streak
// GET /goins/my-rank — real leaderboard position (was hardcoded "Rank #42"
// on the home screen, same as Daily Quest was hardcoded — fixed together)

import { Router, Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { authenticateToken } from "../middleware/authMiddleware";
import { getOrCreateTodayQuest, DAILY_QUEST_TARGET, DAILY_QUEST_REWARD } from "../services/dailyQuestService";

const router = Router();

router.get("/daily-quest", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const progress = await getOrCreateTodayQuest(userId);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { currentStreak: true } });

    res.json({
      videosWatched: progress.videosWatched,
      target: DAILY_QUEST_TARGET,
      completed: progress.completed,
      reward: DAILY_QUEST_REWARD,
      streak: user?.currentStreak ?? 0,
    });
  } catch (e) {
    // Fail open with a harmless zeroed response — a broken quest card
    // should never break the home screen.
    res.json({ videosWatched: 0, target: DAILY_QUEST_TARGET, completed: false, reward: DAILY_QUEST_REWARD, streak: 0 });
  }
});

router.get("/my-rank", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const me = await prisma.user.findUnique({ where: { id: userId }, select: { score: true, role: true, isMentor: true } });
    if (!me || me.role !== "USER" || me.isMentor) {
      // Mentors/admins aren't on the student leaderboard at all (same
      // filter leaderboardRoutes.ts already uses) — no meaningful rank.
      return res.json({ rank: null });
    }

    const higherScoreCount = await prisma.user.count({
      where: { score: { gt: me.score }, role: "USER", isMentor: false },
    });

    res.json({ rank: higherScoreCount + 1 });
  } catch (e) {
    res.json({ rank: null });
  }
});

export default router;
