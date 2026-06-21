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
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const topUsers = await prismaClient_1.default.user.findMany({
            where: {
                score: { gt: 0 },
                role: 'USER', // exclude admins from leaderboard
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
        const leaderboard = topUsers.map((u, i) => ({
            rank: i + 1,
            userId: u.id,
            name: u.name,
            score: u.score,
            badge: u.score >= 1000 ? '🚀' :
                u.score >= 600 ? '🔬' :
                    u.score >= 300 ? '⚙️' :
                        u.score >= 100 ? '🔩' : '🌱',
            level: u.score >= 1000 ? 'Innovator' :
                u.score >= 600 ? 'Inventor' :
                    u.score >= 300 ? 'Builder' :
                        u.score >= 100 ? 'Tinkerer' : 'Sprout',
        }));
        return res.json({ leaderboard });
    }
    catch (err) {
        console.error('leaderboard error:', err);
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
