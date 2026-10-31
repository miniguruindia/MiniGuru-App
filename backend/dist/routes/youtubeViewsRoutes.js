"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/youtubeViewsRoutes.ts
// GET /api/videos/youtube-views?ids=a,b,c  (logged-in users)
// View counts of public videos on the MiniGuru YouTube channel, for the small
// "views on YouTube" badge in the app. Cached 3 hours so a busy day costs almost no
// YouTube quota (one list call of up to 50 videos is 1 unit).
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
const { getVideoViewCounts } = require('../services/youtubeUploadService');
const TTL_MS = 3 * 60 * 60 * 1000;
const cache = new Map();
router.get('/youtube-views', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const ids = String(req.query.ids || '')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => /^[A-Za-z0-9_-]{6,20}$/.test(s))
            .slice(0, 50);
        const now = Date.now();
        const out = {};
        const need = [];
        for (const id of ids) {
            const c = cache.get(id);
            if (c && now - c.at < TTL_MS)
                out[id] = c.v;
            else
                need.push(id);
        }
        if (need.length) {
            try {
                const got = await getVideoViewCounts(need);
                for (const id of Object.keys(got)) {
                    cache.set(id, { v: got[id], at: now });
                    out[id] = got[id];
                }
            }
            catch (e) {
                // YouTube not reachable: send what we have; the badge simply stays hidden
                console.warn('youtube-views: could not fetch', e?.message || e);
                for (const id of need) {
                    const c = cache.get(id);
                    if (c)
                        out[id] = c.v;
                }
            }
        }
        return res.json({ views: out });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
