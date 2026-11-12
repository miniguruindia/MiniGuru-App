// Hindi words (Nov 2026). The app ships with machine-translated Hindi. Anyone can suggest a better word; nothing goes
// live until an admin approves it. Approved words are served here and override the built-in ones in the app.
//   GET  /i18n/hi                          approved Hindi words {overrides: {english: hindi}} (public, cached 5 min)
//   POST /i18n/suggest                     suggest a better Hindi word (no login needed; limited; checked for personal details)
//   GET  /admin/translations/suggestions   admin: suggestions (?status=pending|approved|rejected)
//   POST /admin/translations/suggestions/:id/approve   admin: make it live (optional edited text in body.hi)
//   POST /admin/translations/suggestions/:id/reject    admin: reject
//   GET  /admin/translations               admin: words now overriding the built-in Hindi
//   DELETE /admin/translations/:id         admin: go back to the built-in Hindi for that word
import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { authenticateToken, authenticateTokenOptional, authorizeAdmin } from '../middleware/authMiddleware';
import { patternScreen } from '../services/ideaScreenService';

const db: any = prisma;
export const i18nRouter = Router();
export const adminI18nRouter = Router();

const HAS_DEVANAGARI = /[ऀ-ॿ]/;
const MAX_PENDING = 500;
const hits = new Map<string, number[]>();
function tooMany(who: string): boolean {
  const now = Date.now();
  const recent = (hits.get(who) || []).filter((t) => now - t < 3600_000);
  if (recent.length >= 10) { hits.set(who, recent); return true; }
  recent.push(now); hits.set(who, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

i18nRouter.get('/hi', async (_req: Request, res: Response) => {
  try {
    const rows = await db.translation.findMany({ select: { key: true, hi: true } });
    const overrides: Record<string, string> = {};
    for (const r of rows) overrides[r.key] = r.hi;
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ overrides });
  } catch {
    return res.json({ overrides: {} });
  }
});

i18nRouter.post('/suggest', authenticateTokenOptional, async (req: any, res: Response) => {
  try {
    const key = String(req.body?.key || '').trim().slice(0, 200);
    const suggestion = String(req.body?.suggestion || '').trim().slice(0, 200);
    const screen = String(req.body?.screen || '').trim().slice(0, 40) || null;
    if (!key || !suggestion) return res.status(400).json({ error: 'Please fill both boxes.' });
    if (!HAS_DEVANAGARI.test(suggestion)) return res.status(400).json({ error: 'Please write the word in Hindi (देवनागरी).' });
    if (!patternScreen(suggestion).ok) return res.status(400).json({ error: 'Please do not write phone numbers, emails, links or addresses.' });
    const who = req.user?.userId || String(req.headers['x-forwarded-for'] || req.ip || 'anon').split(',')[0].trim();
    if (tooMany(who)) return res.status(429).json({ error: 'Too many suggestions. Please try again later.' });
    if ((await db.translationSuggestion.count({ where: { status: 'pending' } })) >= MAX_PENDING) {
      return res.status(429).json({ error: 'Our team is reviewing many suggestions. Please try again later.' });
    }
    await db.translationSuggestion.create({ data: { key, suggestion, screen, userId: req.user?.userId || null } });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('i18n suggest:', e?.message || e);
    return res.status(500).json({ error: 'Could not send right now.' });
  }
});

const adminOnly = [authenticateToken, authorizeAdmin];
const okId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

adminI18nRouter.get('/translations/suggestions', ...adminOnly, async (req: Request, res: Response) => {
  try {
    const s = String(req.query.status || 'pending');
    const status = ['pending', 'approved', 'rejected'].includes(s) ? s : 'pending';
    const rows = await db.translationSuggestion.findMany({ where: { status }, orderBy: { createdAt: 'desc' }, take: 200 });
    return res.json({ suggestions: rows });
  } catch { return res.status(500).json({ error: 'Could not load suggestions.' }); }
});

adminI18nRouter.post('/translations/suggestions/:id/approve', ...adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!okId(id)) return res.status(400).json({ error: 'Bad id' });
    const s = await db.translationSuggestion.findUnique({ where: { id } });
    if (!s) return res.status(404).json({ error: 'Not found' });
    const hi = String(req.body?.hi || s.suggestion).trim().slice(0, 200);
    if (!hi || !HAS_DEVANAGARI.test(hi)) return res.status(400).json({ error: 'The Hindi text is empty or not in Hindi.' });
    const existing = await db.translation.findFirst({ where: { key: s.key } });
    if (existing) await db.translation.update({ where: { id: existing.id }, data: { hi } });
    else await db.translation.create({ data: { key: s.key, hi } });
    await db.translationSuggestion.update({ where: { id }, data: { status: 'approved' } });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Could not approve.' }); }
});

adminI18nRouter.post('/translations/suggestions/:id/reject', ...adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!okId(id)) return res.status(400).json({ error: 'Bad id' });
    await db.translationSuggestion.update({ where: { id }, data: { status: 'rejected' } });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Could not reject.' }); }
});

adminI18nRouter.get('/translations', ...adminOnly, async (_req: Request, res: Response) => {
  try {
    const rows = await db.translation.findMany({ orderBy: { updatedAt: 'desc' }, take: 500 });
    return res.json({ translations: rows });
  } catch { return res.status(500).json({ error: 'Could not load.' }); }
});

adminI18nRouter.delete('/translations/:id', ...adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!okId(id)) return res.status(400).json({ error: 'Bad id' });
    await db.translation.delete({ where: { id } });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Could not remove.' }); }
});
