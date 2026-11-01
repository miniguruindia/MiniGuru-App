"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.istDay = void 0;
exports.syncYoutubeViews = syncYoutubeViews;
exports.buildViewsBoard = buildViewsBoard;
// YouTube views ladder (Nov 2026). Same shape as the Goins ladder, ranked by views on YouTube.
// Counts are saved once a day per video (YtViewSnap). A period's views = the count at the end of
// the period minus the count just before it. Before the first saved day nothing is known, so a
// period that starts before then counts from the first saved day. All-time = total views now.
const prismaClient_1 = __importDefault(require("./prismaClient"));
const levelSystem_1 = require("./levelSystem");
const goinsLedger_1 = require("./goinsLedger");
const db = prismaClient_1.default;
const IST = 5.5 * 3600000;
const SYNC_KEY = 'yt_views_sync';
const SYNC_EVERY_MS = 3 * 3600000;
const istDay = (d) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
exports.istDay = istDay;
const ytId = (u) => /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(u || '')?.[1] || '';
/** Saves today's YouTube view count for every published video, at most every 3 hours. Never throws. */
async function syncYoutubeViews() {
    try {
        const rec = await db.siteContent.findUnique({ where: { key: SYNC_KEY } });
        const last = rec?.value?.at ? new Date(rec.value.at).getTime() : 0;
        if (Date.now() - last < SYNC_EVERY_MS)
            return;
        await db.siteContent.upsert({
            where: { key: SYNC_KEY },
            update: { value: { at: new Date().toISOString() } },
            create: { key: SYNC_KEY, value: { at: new Date().toISOString() } },
        });
        const projects = await db.project.findMany({ where: { status: 'published' }, select: { id: true, video: true } });
        const byYt = new Map();
        for (const p of projects) {
            const y = ytId(p.video?.url);
            if (y)
                byYt.set(y, [...(byYt.get(y) || []), p.id]);
        }
        const ids = Array.from(byYt.keys());
        const { getVideoViewCounts } = require('../services/youtubeUploadService');
        const today = (0, exports.istDay)(new Date());
        for (let i = 0; i < ids.length; i += 50) {
            const got = await getVideoViewCounts(ids.slice(i, i + 50));
            for (const y of Object.keys(got)) {
                for (const pid of byYt.get(y) || []) {
                    const ex = await db.ytViewSnap.findFirst({ where: { projectId: pid, day: today }, select: { id: true } });
                    if (ex)
                        await db.ytViewSnap.update({ where: { id: ex.id }, data: { views: got[y] } });
                    else
                        await db.ytViewSnap.create({ data: { projectId: pid, day: today, views: got[y] } });
                }
            }
        }
    }
    catch (e) {
        console.warn('syncYoutubeViews (non-fatal):', e?.message || e);
    }
}
/** start/end are the period bounds (null/null = all-time). */
async function buildViewsBoard(opts) {
    await syncYoutubeViews();
    const where = { status: 'published' };
    if (opts.categoryId)
        where.categoryId = opts.categoryId;
    const projects = await db.project.findMany({ where, select: { id: true, userId: true, collaborators: true, createdAt: true } });
    if (projects.length === 0)
        return [];
    const ids = projects.map((p) => p.id);
    const endDay = opts.end ? (0, exports.istDay)(new Date(Math.min(opts.end.getTime() - 1, Date.now()))) : '9999-12-31';
    const startDay = opts.start ? (0, exports.istDay)(opts.start) : '0000-00-00';
    const snaps = await db.ytViewSnap.findMany({
        where: { projectId: { in: ids }, day: { lte: endDay } },
        select: { projectId: true, day: true, views: true },
        orderBy: { day: 'asc' },
        take: 60000,
    });
    const per = new Map();
    for (const s of snaps)
        per.set(s.projectId, [...(per.get(s.projectId) || []), s]);
    const gained = new Map(); // projectId -> views in period
    for (const p of projects) {
        const list = per.get(p.id) || [];
        if (list.length === 0)
            continue;
        const endV = list[list.length - 1].views;
        if (!opts.start) {
            gained.set(p.id, endV);
            continue;
        }
        const before = list.filter((s) => s.day < startDay);
        // A video uploaded inside the period had no views before it, so it counts from zero.
        const baseV = before.length ? before[before.length - 1].views : (new Date(p.createdAt) >= opts.start ? 0 : list[0].views);
        gained.set(p.id, Math.max(0, endV - baseV));
    }
    const credit = new Map();
    for (const p of projects) {
        const v = gained.get(p.id) || 0;
        if (v <= 0)
            continue;
        const team = new Set([p.userId, ...(p.collaborators || []).map((c) => c.userId)]);
        for (const u of team)
            credit.set(u, (credit.get(u) || 0) + v);
    }
    let userIds = Array.from(credit.keys());
    if (opts.guardianId) {
        const g = await (0, goinsLedger_1.guardianIdsFor)(userIds);
        userIds = userIds.filter((u) => g[u] === opts.guardianId);
    }
    if (userIds.length === 0)
        return [];
    const users = await prismaClient_1.default.user.findMany({
        where: { id: { in: userIds }, role: 'USER', isMentor: false },
        select: { id: true, name: true, score: true, profilePhoto: true },
    });
    const rows = users.map((u) => ({
        userId: u.id, name: u.name, amount: credit.get(u.id) || 0,
        badge: (0, levelSystem_1.getLevelForScore)(u.score).emoji, photo: u.profilePhoto || null,
    }));
    rows.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
    return rows;
}
