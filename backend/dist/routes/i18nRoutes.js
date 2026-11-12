"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminI18nRouter = exports.i18nRouter = void 0;
// Hindi words (Nov 2026). The app ships with machine-translated Hindi. Anyone can suggest a better word; nothing goes
// live until an admin approves it. Approved words are served here and override the built-in ones in the app.
//   GET  /i18n/hi                          approved Hindi words {overrides: {english: hindi}} (public, cached 5 min)
//   POST /i18n/suggest                     suggest a better Hindi word (no login needed; limited; checked for personal details)
//   GET  /admin/translations/suggestions   admin: suggestions (?status=pending|approved|rejected)
//   POST /admin/translations/suggestions/:id/approve   admin: make it live (optional edited text in body.hi)
//   POST /admin/translations/suggestions/:id/reject    admin: reject
//   GET  /admin/translations               admin: words now overriding the built-in Hindi
//   DELETE /admin/translations/:id         admin: go back to the built-in Hindi for that word
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const ideaScreenService_1 = require("../services/ideaScreenService");
const db = prismaClient_1.default;
exports.i18nRouter = (0, express_1.Router)();
exports.adminI18nRouter = (0, express_1.Router)();
const HAS_DEVANAGARI = /[ऀ-ॿ]/;
const MAX_PENDING = 500;
const hits = new Map();
function tooMany(who) {
    const now = Date.now();
    const recent = (hits.get(who) || []).filter((t) => now - t < 3600000);
    if (recent.length >= 10) {
        hits.set(who, recent);
        return true;
    }
    recent.push(now);
    hits.set(who, recent);
    if (hits.size > 5000)
        hits.clear();
    return false;
}
exports.i18nRouter.get('/hi', async (_req, res) => {
    try {
        const rows = await db.translation.findMany({ select: { key: true, hi: true } });
        const overrides = {};
        for (const r of rows)
            overrides[r.key] = r.hi;
        res.set('Cache-Control', 'public, max-age=300');
        return res.json({ overrides });
    }
    catch {
        return res.json({ overrides: {} });
    }
});
exports.i18nRouter.post('/suggest', authMiddleware_1.authenticateTokenOptional, async (req, res) => {
    try {
        const key = String(req.body?.key || '').trim().slice(0, 200);
        const suggestion = String(req.body?.suggestion || '').trim().slice(0, 200);
        const screen = String(req.body?.screen || '').trim().slice(0, 40) || null;
        if (!key || !suggestion)
            return res.status(400).json({ error: 'Please fill both boxes.' });
        if (!HAS_DEVANAGARI.test(suggestion))
            return res.status(400).json({ error: 'Please write the word in Hindi (देवनागरी).' });
        if (!(0, ideaScreenService_1.patternScreen)(suggestion).ok)
            return res.status(400).json({ error: 'Please do not write phone numbers, emails, links or addresses.' });
        const who = req.user?.userId || String(req.headers['x-forwarded-for'] || req.ip || 'anon').split(',')[0].trim();
        if (tooMany(who))
            return res.status(429).json({ error: 'Too many suggestions. Please try again later.' });
        if ((await db.translationSuggestion.count({ where: { status: 'pending' } })) >= MAX_PENDING) {
            return res.status(429).json({ error: 'Our team is reviewing many suggestions. Please try again later.' });
        }
        await db.translationSuggestion.create({ data: { key, suggestion, screen, userId: req.user?.userId || null } });
        return res.json({ ok: true });
    }
    catch (e) {
        console.error('i18n suggest:', e?.message || e);
        return res.status(500).json({ error: 'Could not send right now.' });
    }
});
const adminOnly = [authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin];
const okId = (id) => /^[a-f0-9]{24}$/i.test(id);
exports.adminI18nRouter.get('/translations/suggestions', ...adminOnly, async (req, res) => {
    try {
        const s = String(req.query.status || 'pending');
        const status = ['pending', 'approved', 'rejected'].includes(s) ? s : 'pending';
        const rows = await db.translationSuggestion.findMany({ where: { status }, orderBy: { createdAt: 'desc' }, take: 200 });
        return res.json({ suggestions: rows });
    }
    catch {
        return res.status(500).json({ error: 'Could not load suggestions.' });
    }
});
exports.adminI18nRouter.post('/translations/suggestions/:id/approve', ...adminOnly, async (req, res) => {
    try {
        const id = String(req.params.id);
        if (!okId(id))
            return res.status(400).json({ error: 'Bad id' });
        const s = await db.translationSuggestion.findUnique({ where: { id } });
        if (!s)
            return res.status(404).json({ error: 'Not found' });
        const hi = String(req.body?.hi || s.suggestion).trim().slice(0, 200);
        if (!hi || !HAS_DEVANAGARI.test(hi))
            return res.status(400).json({ error: 'The Hindi text is empty or not in Hindi.' });
        const existing = await db.translation.findFirst({ where: { key: s.key } });
        if (existing)
            await db.translation.update({ where: { id: existing.id }, data: { hi } });
        else
            await db.translation.create({ data: { key: s.key, hi } });
        await db.translationSuggestion.update({ where: { id }, data: { status: 'approved' } });
        return res.json({ ok: true });
    }
    catch {
        return res.status(500).json({ error: 'Could not approve.' });
    }
});
exports.adminI18nRouter.post('/translations/suggestions/:id/reject', ...adminOnly, async (req, res) => {
    try {
        const id = String(req.params.id);
        if (!okId(id))
            return res.status(400).json({ error: 'Bad id' });
        await db.translationSuggestion.update({ where: { id }, data: { status: 'rejected' } });
        return res.json({ ok: true });
    }
    catch {
        return res.status(500).json({ error: 'Could not reject.' });
    }
});
exports.adminI18nRouter.get('/translations', ...adminOnly, async (_req, res) => {
    try {
        const rows = await db.translation.findMany({ orderBy: { updatedAt: 'desc' }, take: 500 });
        return res.json({ translations: rows });
    }
    catch {
        return res.status(500).json({ error: 'Could not load.' });
    }
});
exports.adminI18nRouter.delete('/translations/:id', ...adminOnly, async (req, res) => {
    try {
        const id = String(req.params.id);
        if (!okId(id))
            return res.status(400).json({ error: 'Bad id' });
        await db.translation.delete({ where: { id } });
        return res.json({ ok: true });
    }
    catch {
        return res.status(500).json({ error: 'Could not remove.' });
    }
});
