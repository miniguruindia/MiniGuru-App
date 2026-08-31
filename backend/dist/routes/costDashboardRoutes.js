"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const costTracking_1 = require("../utils/costTracking");
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
exports.default = router;
