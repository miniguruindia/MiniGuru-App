"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const costTracking_1 = require("../utils/costTracking");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin);
// GET /admin/cost-dashboard — live snapshot of every free-tier ceiling this
// project depends on. See costTracking.ts for what's a real live counter
// vs. a point-in-time check vs. a "check the GCP console" note.
router.get('/cost-dashboard', async (_req, res) => {
    try {
        const snapshot = await (0, costTracking_1.getCostDashboardSnapshot)();
        res.json(snapshot);
    }
    catch (err) {
        res.status(500).json({ error: 'Could not load cost dashboard', detail: err?.message });
    }
});
// GET /admin/email-log?limit=100 — latest emails sent (or refused) with today's count
router.get('/email-log', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 300);
        const db = prismaClient_1.default;
        const rows = await db.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
        const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
        ist.setUTCHours(0, 0, 0, 0);
        const startOfIstDay = new Date(ist.getTime() - 5.5 * 3600 * 1000);
        const sentToday = await db.emailLog.count({ where: { status: 'sent', createdAt: { gte: startOfIstDay } } });
        return res.json({ sentToday, rows });
    }
    catch (e) {
        console.error('email-log error:', e);
        return res.status(500).json({ error: 'Could not load the email log' });
    }
});
// GET /admin/amazon-estimate — tentative Amazon earnings from materials lists
// emailed by children/schools. Estimate only: the real figure is in Amazon
// Associates. Commission % can be changed with AMAZON_EST_COMMISSION_PCT
// (default 2).
router.get('/amazon-estimate', async (_req, res) => {
    try {
        const pct = Number(process.env.AMAZON_EST_COMMISSION_PCT) > 0 ? Number(process.env.AMAZON_EST_COMMISSION_PCT) : 2;
        const rows = await prismaClient_1.default.listShare.findMany({
            select: { amazonValue: true, totalValue: true, itemCount: true, amazonItems: true, createdAt: true },
        });
        const now = Date.now();
        const blank = () => ({ lists: 0, amazonListValue: 0, allListValue: 0 });
        const out = { today: blank(), last30Days: blank(), allTime: blank() };
        const startOfIstDay = (() => {
            const ist = new Date(now + 5.5 * 3600 * 1000);
            ist.setUTCHours(0, 0, 0, 0);
            return ist.getTime() - 5.5 * 3600 * 1000;
        })();
        for (const r of rows) {
            const t = r.createdAt.getTime();
            const add = (b) => { b.lists += 1; b.amazonListValue += r.amazonValue; b.allListValue += r.totalValue; };
            add(out.allTime);
            if (now - t <= 30 * 86400000)
                add(out.last30Days);
            if (t >= startOfIstDay)
                add(out.today);
        }
        for (const k of ['today', 'last30Days', 'allTime']) {
            out[k].estimatedEarnings = Math.round(out[k].amazonListValue * pct) / 100;
        }
        out.commissionPct = pct;
        out.note = 'Tentative: ' + pct + '% of the Amazon part of every list emailed to a parent or school, using the shop price estimates. Not every list leads to a purchase, so the real figure is usually lower. Check Amazon Associates for actual earnings.';
        res.json(out);
    }
    catch (err) {
        res.status(500).json({ error: 'Could not load estimate', detail: err?.message });
    }
});
exports.default = router;
