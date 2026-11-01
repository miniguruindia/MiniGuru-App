"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Admin "Ideas" list (Nov 2026). Mounted at /admin. Ideas are not reviewed; admin can only hide or show one.
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin);
const db = prismaClient_1.default;
router.get('/ideas', async (_req, res) => {
    try {
        const rows = await db.idea.findMany({
            orderBy: { createdAt: 'desc' }, take: 300,
            select: { id: true, code: true, title: true, description: true, makerName: true, status: true, tries: true, createdAt: true },
        });
        return res.json({ ideas: rows });
    }
    catch {
        return res.status(500).json({ error: 'Could not load ideas.' });
    }
});
router.post('/ideas/:id/status', async (req, res) => {
    try {
        const id = String(req.params.id);
        const status = req.body?.status === 'hidden' ? 'hidden' : 'visible';
        if (!/^[a-f0-9]{24}$/i.test(id))
            return res.status(400).json({ error: 'Bad id' });
        await db.idea.update({ where: { id }, data: { status } });
        return res.json({ ok: true, status });
    }
    catch {
        return res.status(500).json({ error: 'Could not change it.' });
    }
});
exports.default = router;
