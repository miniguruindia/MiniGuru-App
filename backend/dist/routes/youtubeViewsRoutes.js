"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/youtubeViewsRoutes.ts
// GET /api/videos/youtube-views?ids=a,b,c  (public: guests see the numbers too)
// View counts of public videos on the MiniGuru YouTube channel, for the small
// "views on YouTube" badge in the app. Cached 3 hours so a busy day costs almost no
// YouTube quota (one list call of up to 50 videos is 1 unit).
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const router = (0, express_1.Router)();
const { getVideoViewCounts } = require('../services/youtubeUploadService');
const TTL_MS = 3 * 60 * 60 * 1000;
const cache = new Map();
// Only ids of published MiniGuru videos are looked up (so nobody can use this to query other videos).
let okIds = new Set();
let okAt = 0;
async function publishedIds() {
    if (Date.now() - okAt < 10 * 60 * 1000 && okIds.size)
        return okIds;
    const rows = await prismaClient_1.default.project.findMany({ where: { status: 'published' }, select: { video: true } });
    const s = new Set();
    for (const r of rows) {
        const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(r.video?.url || '');
        if (m)
            s.add(m[1]);
    }
    okIds = s;
    okAt = Date.now();
    return s;
}
router.get('/youtube-views', authMiddleware_1.authenticateTokenOptional, async (req, res) => {
    try {
        const ids = String(req.query.ids || '')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => /^[A-Za-z0-9_-]{6,20}$/.test(s))
            .slice(0, 50);
        const allowed = await publishedIds();
        for (let i = ids.length - 1; i >= 0; i--)
            if (!allowed.has(ids[i]))
                ids.splice(i, 1);
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
