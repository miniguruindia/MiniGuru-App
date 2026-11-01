// YouTube views ladder (Nov 2026). Same shape as the Goins ladder, ranked by views on YouTube.
// Counts are saved once a day per video (YtViewSnap). A period's views = the count at the end of
// the period minus the count just before it. Before the first saved day nothing is known, so a
// period that starts before then counts from the first saved day. All-time = total views now.
import prisma from './prismaClient';
import { getLevelForScore } from './levelSystem';
import { guardianIdsFor } from './goinsLedger';

const db: any = prisma;
const IST = 5.5 * 3600000;
const SYNC_KEY = 'yt_views_sync';
const SYNC_EVERY_MS = 3 * 3600000;

export const istDay = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
const ytId = (u?: string | null) => /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(u || '')?.[1] || '';

/** Saves today's YouTube view count for every published video, at most every 3 hours. Never throws. */
export async function syncYoutubeViews(): Promise<void> {
  try {
    const rec: any = await db.siteContent.findUnique({ where: { key: SYNC_KEY } });
    const last = rec?.value?.at ? new Date(rec.value.at).getTime() : 0;
    if (Date.now() - last < SYNC_EVERY_MS) return;
    await db.siteContent.upsert({
      where: { key: SYNC_KEY },
      update: { value: { at: new Date().toISOString() } },
      create: { key: SYNC_KEY, value: { at: new Date().toISOString() } },
    });
    const projects: any[] = await db.project.findMany({ where: { status: 'published' }, select: { id: true, video: true } });
    const byYt = new Map<string, string[]>();
    for (const p of projects) {
      const y = ytId(p.video?.url);
      if (y) byYt.set(y, [...(byYt.get(y) || []), p.id]);
    }
    const ids = Array.from(byYt.keys());
    const { getVideoViewCounts } = require('../services/youtubeUploadService');
    const today = istDay(new Date());
    for (let i = 0; i < ids.length; i += 50) {
      const got: Record<string, number> = await getVideoViewCounts(ids.slice(i, i + 50));
      for (const y of Object.keys(got)) {
        for (const pid of byYt.get(y) || []) {
          const ex = await db.ytViewSnap.findFirst({ where: { projectId: pid, day: today }, select: { id: true } });
          if (ex) await db.ytViewSnap.update({ where: { id: ex.id }, data: { views: got[y] } });
          else await db.ytViewSnap.create({ data: { projectId: pid, day: today, views: got[y] } });
        }
      }
    }
  } catch (e: any) {
    console.warn('syncYoutubeViews (non-fatal):', e?.message || e);
  }
}

export interface ViewRow { userId: string; name: string; amount: number; badge: string; photo: string | null }

/** start/end are the period bounds (null/null = all-time). */
export async function buildViewsBoard(opts: { start: Date | null; end: Date | null; categoryId?: string; guardianId?: string | null }): Promise<ViewRow[]> {
  await syncYoutubeViews();
  const where: any = { status: 'published' };
  if (opts.categoryId) where.categoryId = opts.categoryId;
  const projects: any[] = await db.project.findMany({ where, select: { id: true, userId: true, collaborators: true } });
  if (projects.length === 0) return [];
  const ids = projects.map((p) => p.id);
  const endDay = opts.end ? istDay(new Date(Math.min(opts.end.getTime() - 1, Date.now()))) : '9999-12-31';
  const startDay = opts.start ? istDay(opts.start) : '0000-00-00';
  const snaps: any[] = await db.ytViewSnap.findMany({
    where: { projectId: { in: ids }, day: { lte: endDay } },
    select: { projectId: true, day: true, views: true },
    orderBy: { day: 'asc' },
    take: 60000,
  });
  const per = new Map<string, any[]>();
  for (const s of snaps) per.set(s.projectId, [...(per.get(s.projectId) || []), s]);

  const gained = new Map<string, number>(); // projectId -> views in period
  for (const p of projects) {
    const list = per.get(p.id) || [];
    if (list.length === 0) continue;
    const endV = list[list.length - 1].views;
    if (!opts.start) { gained.set(p.id, endV); continue; }
    const before = list.filter((s) => s.day < startDay);
    const baseV = before.length ? before[before.length - 1].views : list[0].views;
    gained.set(p.id, Math.max(0, endV - baseV));
  }

  const credit = new Map<string, number>();
  for (const p of projects) {
    const v = gained.get(p.id) || 0;
    if (v <= 0) continue;
    const team = new Set<string>([p.userId, ...((p.collaborators || []) as any[]).map((c) => c.userId)]);
    for (const u of team) credit.set(u, (credit.get(u) || 0) + v);
  }
  let userIds = Array.from(credit.keys());
  if (opts.guardianId) {
    const g = await guardianIdsFor(userIds);
    userIds = userIds.filter((u) => g[u] === opts.guardianId);
  }
  if (userIds.length === 0) return [];
  const users: any[] = await prisma.user.findMany({
    where: { id: { in: userIds }, role: 'USER', isMentor: false },
    select: { id: true, name: true, score: true, profilePhoto: true },
  });
  const rows: ViewRow[] = users.map((u: any) => ({
    userId: u.id, name: u.name, amount: credit.get(u.id) || 0,
    badge: getLevelForScore(u.score).emoji, photo: u.profilePhoto || null,
  }));
  rows.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  return rows;
}
