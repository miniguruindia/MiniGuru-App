"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Idea Pool (Nov 2026). Mounted at /ideas (logged-in users).
//   GET  /ideas?q=&type=all|ideas|projects   the pool: shared ideas + finished projects; search by words or ID
//   GET  /ideas/:id                           one idea with sketch and materials
//   POST /ideas/share                         share an idea (checked automatically, no staff review)
//   POST /ideas/:id/try                       "I'll try this": returns the idea to copy; maker gets 5 Goins
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const resolveSubject_1 = require("../middleware/resolveSubject");
const ideaScreenService_1 = require("../services/ideaScreenService");
const videoCode_1 = require("../utils/videoCode");
const goinsLedger_1 = require("../utils/goinsLedger");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
const db = prismaClient_1.default;
const TRY_GOINS = 5;
const MAX_PAID_TRIES = 10; // 50 Goins per idea at most
const first = (n) => (n || 'A maker').trim().split(/\s+/)[0];
const ytId = (u) => /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(u || '')?.[1] || '';
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
function ideaCard(i) {
    const mats = Array.isArray(i.materials) ? i.materials : [];
    return {
        type: 'idea', id: i.id, code: i.code, title: i.title, description: clip(i.description || '', 160),
        maker: i.makerName, tries: i.tries || 0, materials: mats.slice(0, 5).map((m) => m.name).filter(Boolean),
        hasSketch: !!i.sketch, createdAt: i.createdAt,
    };
}
function projectCard(p) {
    const mats = Array.isArray(p.materials) ? p.materials : [];
    const collab = Array.isArray(p.collaborators) ? p.collaborators : [];
    return {
        type: 'project', id: p.id, projectId: p.id, ownerId: p.userId, code: p.planId || null, videoCode: p.videoCode || null,
        title: p.title, description: clip(p.description || '', 160),
        maker: [first(p.user?.name), ...collab.map((c) => first(c.name))].join(', '),
        channelTitle: [p.user?.name || 'MiniGuru Maker', ...collab.map((c) => c.name)].join(', '),
        materials: mats.slice(0, 5).map((m) => m.name).filter(Boolean), videoId: ytId(p.video?.url),
        thumbnail: p.thumbnail || '', createdAt: p.updatedAt,
    };
}
router.get('/', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().slice(0, 80);
        const type = String(req.query.type || 'all');
        await (0, videoCode_1.ensureVideoCodes)(60);
        let ideaWhere = { status: 'visible' };
        let projWhere = { status: 'published' };
        if (q) {
            const up = q.toUpperCase();
            if (/^MG-V-/.test(up)) {
                ideaWhere = null;
                projWhere.videoCode = up;
            }
            else if (/^MG-/.test(up)) {
                ideaWhere.code = up;
                projWhere.planId = up;
            }
            else {
                const w = { contains: q, mode: 'insensitive' };
                ideaWhere.OR = [{ title: w }, { description: w }, { makerName: w }];
                projWhere.OR = [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
            }
        }
        const [ideas, projects] = await Promise.all([
            type === 'projects' || !ideaWhere ? [] : db.idea.findMany({ where: ideaWhere, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, code: true, title: true, description: true, makerName: true, tries: true, materials: true, createdAt: true, sketch: true } }),
            type === 'ideas' ? [] : db.project.findMany({ where: projWhere, orderBy: { updatedAt: 'desc' }, take: 30, include: { user: { select: { name: true } } } }),
        ]);
        const items = [...ideas.map(ideaCard), ...projects.filter((p) => p.video?.url).map(projectCard)]
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 40);
        return res.json({ items });
    }
    catch (e) {
        console.error('ideas list:', e?.message || e);
        return res.status(500).json({ error: 'Could not load ideas.' });
    }
});
router.get('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const id = String(req.params.id);
        if (!/^[a-f0-9]{24}$/i.test(id))
            return res.status(400).json({ error: 'Bad id' });
        const i = await db.idea.findUnique({ where: { id } });
        if (!i || i.status !== 'visible')
            return res.status(404).json({ error: 'Not found' });
        return res.json({ ...ideaCard(i), description: i.description, sketch: i.sketch || null, materials: i.materials || [], category: i.category || '' });
    }
    catch {
        return res.status(500).json({ error: 'Could not load.' });
    }
});
router.post('/share', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const authedId = req.user?.userId;
        if (!authedId)
            return res.status(401).json({ error: 'Unauthorized' });
        const ownerId = req.subject?.isChild ? (req.subject.linkedUserId || authedId) : authedId;
        const b = req.body || {};
        const title = String(b.title || '').trim();
        const description = String(b.description || '').trim();
        const code = String(b.planId || '').trim().toUpperCase();
        if (title.length < 3 || title.length > 80)
            return res.status(400).json({ error: 'Please give your idea a title (3 to 80 letters).' });
        if (description.length < 10 || description.length > 1500)
            return res.status(400).json({ error: 'Please describe your idea in a few words (10 to 1500 letters).' });
        if (!/^MG-[A-Z]{1,6}-[A-Z]{1,3}-\d{4,}$/.test(code))
            return res.status(400).json({ error: 'Please save your planning sheet first so it gets an ID.' });
        const sketch = typeof b.sketch === 'string' && b.sketch.length < 600000 && /^[A-Za-z0-9+/=]+$/.test(b.sketch) ? b.sketch : null;
        const materials = (Array.isArray(b.materials) ? b.materials : []).slice(0, 30)
            .map((m) => ({ id: String(m?.id || '').slice(0, 40), name: String(m?.name || '').slice(0, 60), quantity: Math.max(1, Math.min(999, Number(m?.quantity) || 1)) }))
            .filter((m) => m.name);
        const owner = await db.user.findUnique({ where: { id: ownerId }, select: { name: true } });
        const makerName = first(req.subject?.isChild ? req.subject.name : owner?.name);
        const scr = await (0, ideaScreenService_1.screenIdea)(title, description, materials.map((m) => m.name).join(', '), sketch);
        if (!scr.ok) {
            return res.status(422).json({ error: `Your idea was not shared because it seems to have ${scr.reason}. Please remove it and try again.` });
        }
        const existing = await db.idea.findFirst({ where: { code, makerUserId: ownerId } });
        if (existing) {
            const row = await db.idea.update({
                where: { id: existing.id },
                data: { title, description, sketch, materials, category: String(b.category || '').slice(0, 40) || null, makerName },
            });
            return res.json({ shared: true, id: row.id, status: row.status });
        }
        const row = await db.idea.create({
            data: { code, title, description, sketch, materials, category: String(b.category || '').slice(0, 40) || null, makerUserId: ownerId, makerName },
        });
        return res.json({ shared: true, id: row.id, status: row.status });
    }
    catch (e) {
        console.error('idea share:', e?.message || e);
        return res.status(500).json({ error: 'Could not share the idea right now.' });
    }
});
router.post('/:id/try', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const authedId = req.user?.userId;
        if (!authedId)
            return res.status(401).json({ error: 'Unauthorized' });
        const me = req.subject?.isChild ? (req.subject.linkedUserId || authedId) : authedId;
        const id = String(req.params.id);
        if (!/^[a-f0-9]{24}$/i.test(id))
            return res.status(400).json({ error: 'Bad id' });
        const i = await db.idea.findUnique({ where: { id } });
        if (!i || i.status !== 'visible')
            return res.status(404).json({ error: 'Not found' });
        const detail = { ...ideaCard(i), description: i.description, sketch: i.sketch || null, materials: i.materials || [], category: i.category || '' };
        if (i.makerUserId === me)
            return res.json({ idea: detail, goinsGiven: 0, own: true });
        const already = await db.ideaTry.findFirst({ where: { ideaId: id, userId: me } });
        if (already)
            return res.json({ idea: detail, goinsGiven: 0, already: true });
        await db.ideaTry.create({ data: { ideaId: id, userId: me } });
        let paid = false;
        const bumped = await db.idea.update({ where: { id }, data: { tries: { increment: 1 } } });
        if ((bumped.paidTries || 0) < MAX_PAID_TRIES) {
            await db.idea.update({ where: { id }, data: { paidTries: { increment: 1 } } });
            await db.user.update({ where: { id: i.makerUserId }, data: { score: { increment: TRY_GOINS } } });
            await (0, goinsLedger_1.recordGoinsEvents)([{ userId: i.makerUserId, amount: TRY_GOINS, source: 'IDEA_TRIED', reason: `A child tried your idea "${i.title}"` }]);
            (0, notificationService_1.notifyUser)({ userId: i.makerUserId, type: 'idea_tried', emoji: '💡', message: `A child is trying your idea "${i.title}"! +${TRY_GOINS} Goins` }).catch(() => { });
            paid = true;
        }
        return res.json({ idea: detail, goinsGiven: paid ? TRY_GOINS : 0 });
    }
    catch (e) {
        console.error('idea try:', e?.message || e);
        return res.status(500).json({ error: 'Could not do that right now.' });
    }
});
exports.default = router;
