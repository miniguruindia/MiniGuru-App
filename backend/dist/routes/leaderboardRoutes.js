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
const authMiddleware_1 = require("../middleware/authMiddleware");
const goinsLedger_1 = require("../utils/goinsLedger");
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
// ═══════════════════════════════════════════════════════════════════════════
// Period boards (Oct 2026) — highest Goins EARNED for building in a window,
// from the GoinsEvent ledger, instead of the all-time total (where whoever
// gets ahead stays ahead). Students only.
//
//   GET /leaderboard/period?period=week|month|year&offset=0|-1|-2...
//        &scope=app|school&categoryId=<id>&limit=20
//   GET /leaderboard/winners?period=week|month|year&count=6
//        &scope=app|school&categoryId=<id>      (top 3 of each past period)
//
// scope=school needs a logged-in user (token optional otherwise): it shows
// the board of the school/T-LAB the child belongs to (or, for a school's own
// login, that school's students).
// ═══════════════════════════════════════════════════════════════════════════
const db = prismaClient_1.default;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
function readPeriod(q) {
    return q.period === 'month' || q.period === 'year' ? q.period : 'week';
}
async function resolveGuardianId(userId) {
    if (!userId)
        return null;
    const me = await prismaClient_1.default.user.findUnique({ where: { id: userId }, select: { isMentor: true } });
    if (me?.isMentor)
        return userId; // a school's own login sees its own students
    const cp = await prismaClient_1.default.childProfile.findFirst({
        where: { linkedUserId: userId, isActive: true },
        select: { guardianId: true },
    });
    return cp?.guardianId || null;
}
async function buildBoard(where) {
    const groups = await db.goinsEvent.groupBy({ by: ['userId'], where, _sum: { amount: true } });
    const positive = groups.filter((g) => (g._sum?.amount || 0) > 0);
    if (positive.length === 0)
        return [];
    const users = await prismaClient_1.default.user.findMany({
        where: { id: { in: positive.map((g) => g.userId) }, role: 'USER', isMentor: false },
        select: { id: true, name: true, score: true, profilePhoto: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const rows = [];
    for (const g of positive) {
        const u = byId.get(g.userId);
        if (!u)
            continue; // admins / mentors / deleted accounts
        rows.push({
            userId: u.id,
            name: u.name,
            amount: g._sum.amount,
            badge: (0, levelSystem_1.getLevelForScore)(u.score).emoji,
            photo: u.profilePhoto || null,
        });
    }
    rows.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
    return rows;
}
function rankOf(rows, amount) {
    return 1 + rows.filter((r) => r.amount > amount).length; // ties share a rank
}
router.get('/period', authMiddleware_1.authenticateTokenOptional, async (req, res) => {
    try {
        const q = req.query;
        const period = readPeriod(q);
        let offset = parseInt(q.offset, 10);
        if (!Number.isFinite(offset) || offset > 0)
            offset = 0;
        if (offset < -120)
            offset = -120;
        const scope = q.scope === 'school' ? 'school' : 'app';
        const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));
        const { start, end, label } = (0, goinsLedger_1.periodRange)(period, offset);
        const where = { createdAt: { gte: start, lt: end } };
        if (typeof q.categoryId === 'string' && OBJECT_ID.test(q.categoryId))
            where.categoryId = q.categoryId;
        const meId = req.user?.userId;
        if (scope === 'school') {
            const gid = await resolveGuardianId(meId);
            if (!gid) {
                return res.json({ period, offset, label, scope, entries: [], myRank: null, myAmount: null, needsSchool: true });
            }
            where.guardianId = gid;
        }
        const rows = await buildBoard(where);
        const entries = rows.slice(0, limit).map((r) => ({
            rank: rankOf(rows, r.amount),
            userId: r.userId,
            name: r.name,
            amount: r.amount,
            badge: r.badge,
            isMe: r.userId === meId,
        }));
        const mine = meId ? rows.find((r) => r.userId === meId) : undefined;
        return res.json({
            period,
            offset,
            label,
            scope,
            entries,
            myRank: mine ? rankOf(rows, mine.amount) : null,
            myAmount: mine ? mine.amount : null,
            totalParticipants: rows.length,
        });
    }
    catch (err) {
        console.error('leaderboard/period error:', err);
        return res.status(500).json({ error: 'Could not load the leaderboard.' });
    }
});
router.get('/winners', authMiddleware_1.authenticateTokenOptional, async (req, res) => {
    try {
        const q = req.query;
        const period = readPeriod(q);
        const count = Math.min(12, Math.max(1, parseInt(q.count, 10) || 6));
        const scope = q.scope === 'school' ? 'school' : 'app';
        const base = {};
        if (typeof q.categoryId === 'string' && OBJECT_ID.test(q.categoryId))
            base.categoryId = q.categoryId;
        if (scope === 'school') {
            const gid = await resolveGuardianId(req.user?.userId);
            if (!gid)
                return res.json({ period, scope, winners: [], needsSchool: true });
            base.guardianId = gid;
        }
        const winners = [];
        for (let i = 1; i <= count; i++) {
            const { start, end, label } = (0, goinsLedger_1.periodRange)(period, -i);
            const rows = await buildBoard({ ...base, createdAt: { gte: start, lt: end } });
            if (rows.length === 0)
                continue;
            winners.push({
                label,
                offset: -i,
                top: rows.slice(0, 3).map((r) => ({ rank: rankOf(rows, r.amount), name: r.name, amount: r.amount, badge: r.badge })),
            });
        }
        return res.json({ period, scope, winners });
    }
    catch (err) {
        console.error('leaderboard/winners error:', err);
        return res.status(500).json({ error: 'Could not load past winners.' });
    }
});
exports.default = router;
