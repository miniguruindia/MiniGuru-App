"use strict";
// backend/src/routes/dailyQuestRoutes.ts
// GET /goins/daily-quest — today's real Daily Quest progress + streak
// GET /goins/my-rank — real leaderboard position (was hardcoded "Rank #42"
// on the home screen, same as Daily Quest was hardcoded — fixed together)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const dailyQuestService_1 = require("../services/dailyQuestService");
const router = (0, express_1.Router)();
router.get("/daily-quest", authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ message: "Not authenticated" });
        const progress = await (0, dailyQuestService_1.getOrCreateTodayQuest)(userId);
        const user = await prismaClient_1.default.user.findUnique({ where: { id: userId }, select: { currentStreak: true } });
        res.json({
            videosWatched: progress.videosWatched,
            target: dailyQuestService_1.DAILY_QUEST_TARGET,
            completed: progress.completed,
            reward: dailyQuestService_1.DAILY_QUEST_REWARD,
            streak: user?.currentStreak ?? 0,
        });
    }
    catch (e) {
        // Fail open with a harmless zeroed response — a broken quest card
        // should never break the home screen.
        res.json({ videosWatched: 0, target: dailyQuestService_1.DAILY_QUEST_TARGET, completed: false, reward: dailyQuestService_1.DAILY_QUEST_REWARD, streak: 0 });
    }
});
router.get("/my-rank", authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ message: "Not authenticated" });
        const me = await prismaClient_1.default.user.findUnique({ where: { id: userId }, select: { score: true, role: true, isMentor: true } });
        if (!me || me.role !== "USER" || me.isMentor) {
            // Mentors/admins aren't on the student leaderboard at all (same
            // filter leaderboardRoutes.ts already uses) — no meaningful rank.
            return res.json({ rank: null });
        }
        const higherScoreCount = await prismaClient_1.default.user.count({
            where: { score: { gt: me.score }, role: "USER", isMentor: false },
        });
        res.json({ rank: higherScoreCount + 1 });
    }
    catch (e) {
        res.json({ rank: null });
    }
});
exports.default = router;
