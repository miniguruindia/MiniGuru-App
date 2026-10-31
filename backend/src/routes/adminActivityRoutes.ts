// backend/src/routes/adminActivityRoutes.ts
// Admin "Activity" page (Oct 2026). Mounted at /admin. Read-only.
//   GET /admin/activity/summary   totals, 8 weekly numbers, sign-up funnel, sources, list shares
//   GET /admin/activity/users?days=7|30   what each account did, and who has gone quiet
// "Active" in the weekly numbers means the account did at least one real thing that week
// (watched, commented, liked, rated, uploaded or earned Goins). "Last active" is saved when the
// app is used and only exists from the day this was deployed.
import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticateToken, authorizeAdmin);
const db: any = prisma;
const DAY = 86400000;
const CAP = 60000;

// Monday 00:00 (IST) of the week containing d, as a UTC Date
function weekStart(d: Date): Date {
  const ist = new Date(d.getTime() + 5.5 * 3600000);
  const dow = (ist.getUTCDay() + 6) % 7; // Monday = 0
  const midnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - dow * DAY;
  return new Date(midnight - 5.5 * 3600000);
}

async function events(since: Date) {
  const w = { createdAt: { gte: since } };
  const [views, comments, likes, ratings, projects, goins] = await Promise.all([
    db.videoView.findMany({ where: w, select: { userId: true, createdAt: true }, take: CAP }),
    db.videoComment.findMany({ where: w, select: { userId: true, createdAt: true }, take: CAP }),
    db.videoLike.findMany({ where: w, select: { userId: true, createdAt: true }, take: CAP }),
    db.videoRating.findMany({ where: w, select: { raterId: true, createdAt: true }, take: CAP }),
    db.project.findMany({ where: w, select: { userId: true, createdAt: true }, take: CAP }),
    db.goinsEvent.findMany({ where: { ...w, isBackfill: false, amount: { gt: 0 } }, select: { userId: true, amount: true, createdAt: true }, take: CAP }),
  ]);
  return { views, comments, likes, ratings, projects, goins };
}

router.get('/activity/summary', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const thisWeek = weekStart(now);
    const first = new Date(thisWeek.getTime() - 7 * 7 * DAY);          // 8 weeks incl. this one
    const d7 = new Date(now.getTime() - 7 * DAY);
    const d30 = new Date(now.getTime() - 30 * DAY);
    const d1 = new Date(now.getTime() - DAY);

    const ev = await events(first);
    const weeks: { start: string; signups: number; active: number }[] = [];
    const sets: Set<string>[] = [];
    for (let i = 0; i < 8; i++) { sets.push(new Set()); }
    const bucket = (t: Date) => Math.floor((new Date(t).getTime() - first.getTime()) / (7 * DAY));
    const mark = (rows: any[], f: string) => rows.forEach((r) => { const b = bucket(r.createdAt); if (b >= 0 && b < 8) sets[b].add(String(r[f])); });
    mark(ev.views, 'userId'); mark(ev.comments, 'userId'); mark(ev.likes, 'userId');
    mark(ev.ratings, 'raterId'); mark(ev.projects, 'userId'); mark(ev.goins, 'userId');
    const signedUp = await db.user.findMany({ where: { createdAt: { gte: first }, role: 'USER' }, select: { createdAt: true }, take: CAP });
    const sc = new Array(8).fill(0);
    signedUp.forEach((u: any) => { const b = bucket(u.createdAt); if (b >= 0 && b < 8) sc[b]++; });
    for (let i = 0; i < 8; i++) {
      weeks.push({ start: new Date(first.getTime() + i * 7 * DAY).toISOString(), signups: sc[i], active: sets[i].size });
    }

    const [total, new7, new30, a1, a7, a30, firstSeen] = await Promise.all([
      db.user.count({ where: { role: 'USER' } }),
      db.user.count({ where: { role: 'USER', createdAt: { gte: d7 } } }),
      db.user.count({ where: { role: 'USER', createdAt: { gte: d30 } } }),
      db.user.count({ where: { role: 'USER', lastActiveAt: { gte: d1 } } }),
      db.user.count({ where: { role: 'USER', lastActiveAt: { gte: d7 } } }),
      db.user.count({ where: { role: 'USER', lastActiveAt: { gte: d30 } } }),
      db.user.findFirst({ where: { lastActiveAt: { not: null } }, orderBy: { lastActiveAt: 'asc' }, select: { lastActiveAt: true } }),
    ]);

    // Sign-up funnel for people who joined in the last 30 days
    const cohort = await db.user.findMany({ where: { role: 'USER', createdAt: { gte: d30 } }, select: { id: true, createdAt: true, lastActiveAt: true, signupSource: true }, take: 5000 });
    const ids = cohort.map((u: any) => u.id);
    const inIds = { in: ids.length ? ids : ['000000000000000000000000'] };
    const [vw, pr, pub, cm, rt] = await Promise.all([
      db.videoView.findMany({ where: { userId: inIds }, select: { userId: true }, distinct: ['userId'] }),
      db.project.findMany({ where: { userId: inIds }, select: { userId: true }, distinct: ['userId'] }),
      db.project.findMany({ where: { userId: inIds, status: 'published' }, select: { userId: true }, distinct: ['userId'] }),
      db.videoComment.findMany({ where: { userId: inIds }, select: { userId: true }, distinct: ['userId'] }),
      db.videoRating.findMany({ where: { raterId: inIds }, select: { raterId: true }, distinct: ['raterId'] }),
    ]);
    const cameBack = cohort.filter((u: any) => u.lastActiveAt && new Date(u.lastActiveAt).getTime() - new Date(u.createdAt).getTime() > DAY).length;
    const engaged = new Set<string>([...cm.map((r: any) => String(r.userId)), ...rt.map((r: any) => String(r.raterId))]);
    const funnel = [
      { step: 'Signed up', count: cohort.length },
      { step: 'Came back on another day', count: cameBack, note: 'counted from the day tracking started' },
      { step: 'Watched a video', count: vw.length },
      { step: 'Commented or rated', count: engaged.size },
      { step: 'Uploaded a project', count: pr.length },
      { step: 'Had a video published', count: pub.length },
    ];

    const src = new Map<string, number>();
    cohort.forEach((u: any) => { const k = u.signupSource || 'added by a school or parent, or before tracking'; src.set(k, (src.get(k) || 0) + 1); });
    const sources = Array.from(src.entries()).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

    const shares30 = await db.listShare.findMany({ where: { createdAt: { gte: d30 } }, orderBy: { createdAt: 'desc' }, take: 2000 });
    const by: Record<string, number> = {};
    let amazonValue = 0;
    shares30.forEach((s: any) => { by[s.source] = (by[s.source] || 0) + 1; amazonValue += s.amazonValue || 0; });
    const shares = {
      last7: shares30.filter((s: any) => new Date(s.createdAt) >= d7).length,
      last30: shares30.length,
      bySource: by,
      amazonValueLast30: amazonValue,
      latest: shares30.slice(0, 10).map((s: any) => ({ source: s.source, senderName: s.senderName, itemCount: s.itemCount, amazonItems: s.amazonItems, amazonValue: s.amazonValue, createdAt: s.createdAt })),
    };

    return res.json({
      totals: { total, new7, new30, active1: a1, active7: a7, active30: a30, trackingSince: firstSeen?.lastActiveAt ?? null },
      weeks, funnel, sources, shares,
    });
  } catch (e: any) {
    console.error('activity summary error:', e);
    return res.status(500).json({ message: 'Could not load activity' });
  }
});

router.get('/activity/users', async (req: Request, res: Response) => {
  try {
    const days = req.query.days === '30' ? 30 : 7;
    const since = new Date(Date.now() - days * DAY);
    const ev = await events(since);
    const per = new Map<string, any>();
    const row = (id: string) => { let r = per.get(id); if (!r) { r = { userId: id, views: 0, comments: 0, likes: 0, ratings: 0, projects: 0, goins: 0 }; per.set(id, r); } return r; };
    ev.views.forEach((r: any) => row(String(r.userId)).views++);
    ev.comments.forEach((r: any) => row(String(r.userId)).comments++);
    ev.likes.forEach((r: any) => row(String(r.userId)).likes++);
    ev.ratings.forEach((r: any) => row(String(r.raterId)).ratings++);
    ev.projects.forEach((r: any) => row(String(r.userId)).projects++);
    ev.goins.forEach((r: any) => { row(String(r.userId)).goins += r.amount || 0; });
    const ids = Array.from(per.keys()).slice(0, 2000);
    const users = ids.length ? await db.user.findMany({ where: { id: { in: ids }, role: 'USER' }, select: { id: true, name: true, email: true, schoolName: true, lastActiveAt: true, createdAt: true } }) : [];
    const u = new Map<string, any>(users.map((x: any) => [x.id, x]));
    const active = Array.from(per.values()).filter((r) => u.has(r.userId)).map((r) => ({
      ...r,
      name: u.get(r.userId).name, email: u.get(r.userId).email, school: u.get(r.userId).schoolName ?? null,
      lastActiveAt: u.get(r.userId).lastActiveAt ?? null,
      score: r.views + r.comments * 2 + r.likes + r.ratings * 2 + r.projects * 5,
    })).sort((a, b) => b.score - a.score).slice(0, 200);

    const quietBefore = new Date(Date.now() - 14 * DAY);
    const quietRows = await db.user.findMany({
      where: { role: 'USER', lastActiveAt: { not: null, lt: quietBefore } },
      orderBy: { lastActiveAt: 'asc' }, take: 50,
      select: { id: true, name: true, email: true, schoolName: true, lastActiveAt: true },
    });
    return res.json({
      days, active,
      quiet: quietRows.map((x: any) => ({ userId: x.id, name: x.name, email: x.email, school: x.schoolName ?? null, lastActiveAt: x.lastActiveAt })),
    });
  } catch (e: any) {
    console.error('activity users error:', e);
    return res.status(500).json({ message: 'Could not load activity' });
  }
});

export default router;
