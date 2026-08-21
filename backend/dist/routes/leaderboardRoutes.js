"use strict";
// backend/src/routes/leaderboardRoutes.ts
// GET /leaderboard — top 10 users by score (Goins)
// Public endpoint — no auth needed
// Used by community_screen.dart Ladder tab
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const levelSystem_1 = require("../utils/levelSystem");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const topUsers = await prismaClient_1.default.user.findMany({
            where: {
                score: { gt: 0 },
                role: 'USER', // exclude admins from leaderboard
                isMentor: false, // exclude parents/schools/T-LABs — students only
            },
            orderBy: { score: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                score: true,
                profilePhoto: true,
            },
        });
        // BUGFIX (Aug 2026): this used to compute badge/level with its own
        // inline thresholds (600/300/100), disagreeing with at least 3 OTHER
        // hardcoded copies of "the level system" elsewhere in the codebase.
        // Now uses the one canonical getLevelForScore() everywhere.
        const leaderboard = topUsers.map((u, i) => {
            const lvl = (0, levelSystem_1.getLevelForScore)(u.score);
            return {
                rank: i + 1,
                userId: u.id,
                name: u.name,
                score: u.score,
                badge: lvl.emoji,
                level: lvl.title,
                levelNumber: lvl.level,
            };
        });
        return res.json({ leaderboard });
    }
    catch (err) {
        console.error('leaderboard error:', err);
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
