// POST /plan-ids   (logged-in; works inside a mentor's child session too)
// Gives a planning sheet its permanent ID: MG-<SCHOOL>-<INITIALS>-<NNNN>.
// The number comes from ONE atomic counter (Mongo findAndModify with $inc), so two
// children can never get the same number. The first number handed out is 42,
// because 41 videos already exist (they get 1-41 later).
import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';
import { resolveSubject } from '../middleware/resolveSubject';
import { buildPlanCode } from '../utils/planCode';

const router = Router();
const FIRST_NUMBER = 42;

router.post('/', authenticateToken, resolveSubject, async (req: any, res: Response) => {
  try {
    const authedId = req.user?.userId;
    if (!authedId) return res.status(401).json({ error: 'Unauthorized' });
    // The child's own account when a mentor is in a PIN session, else the logged-in user.
    const ownerId: string = req.subject?.isChild ? (req.subject.linkedUserId || authedId) : authedId;
    const owner: any = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { name: true, schoolName: true },
    });
    const name = req.subject?.isChild ? req.subject.name : owner?.name;
    let school: string | null = owner?.schoolName ?? null;
    if (!school && req.subject?.isChild && req.subject.guardianId) {
      const g: any = await prisma.user.findUnique({ where: { id: req.subject.guardianId }, select: { schoolName: true } });
      school = g?.schoolName ?? null;
    }

    const r: any = await (prisma as any).$runCommandRaw({
      findAndModify: 'plan_counter',
      query: { _id: 'plan' },
      update: { $inc: { seq: 1 } },
      new: true,
      upsert: true,
    });
    const seq = Number(r?.value?.seq);
    if (!Number.isFinite(seq) || seq < 1) return res.status(500).json({ error: 'Could not create an ID right now.' });
    const number = seq + FIRST_NUMBER - 1;
    const code = buildPlanCode(school, name, number);
    const row: any = await (prisma as any).planSheet.create({
      data: { number, code, userId: ownerId },
    });
    return res.json({ code, number, createdAt: row.createdAt });
  } catch (e: any) {
    console.error('plan-ids error:', e?.message || e);
    return res.status(500).json({ error: 'Could not create an ID right now.' });
  }
});

// GET /plan-ids/maker  -> {name, school} of whoever is active (for the printed sheet header)
router.get('/maker', authenticateToken, resolveSubject, async (req: any, res: Response) => {
  try {
    const authedId = req.user?.userId;
    if (!authedId) return res.status(401).json({ error: 'Unauthorized' });
    const ownerId: string = req.subject?.isChild ? (req.subject.linkedUserId || authedId) : authedId;
    const owner: any = await prisma.user.findUnique({ where: { id: ownerId }, select: { name: true, schoolName: true } });
    return res.json({ name: req.subject?.isChild ? req.subject.name : owner?.name || '', school: owner?.schoolName || '' });
  } catch {
    return res.status(500).json({ error: 'Could not load.' });
  }
});

// GET /plan-ids/project/:projectId -> everything the printed planning sheet needs.
// Allowed: the owner, a collaborator, a guardian of the owner (mentor), or an admin.
router.get('/project/:projectId', authenticateToken, resolveSubject, async (req: any, res: Response) => {
  try {
    const authedId = req.user?.userId;
    if (!authedId) return res.status(401).json({ error: 'Unauthorized' });
    const pid = String(req.params.projectId || '');
    if (!/^[a-f0-9]{24}$/i.test(pid)) return res.status(400).json({ error: 'Bad id' });
    const p: any = await prisma.project.findUnique({
      where: { id: pid },
      include: { category: true, user: { select: { id: true, name: true, schoolName: true } } },
    });
    if (!p) return res.status(404).json({ error: 'Not found' });
    const me: any = await prisma.user.findUnique({ where: { id: authedId }, select: { role: true } });
    const activeId: string = req.subject?.isChild ? (req.subject.linkedUserId || authedId) : authedId;
    const isOwner = p.userId === activeId || p.userId === authedId;
    const isCollab = (p.collaborators || []).some((c: any) => c.userId === activeId || c.userId === authedId);
    let ok = isOwner || isCollab || me?.role === 'ADMIN';
    if (!ok) {
      // a mentor / guardian of the child who owns it
      const child: any = await (prisma as any).childProfile.findFirst({ where: { linkedUserId: p.userId, guardianId: authedId }, select: { id: true } });
      ok = !!child;
    }
    if (!ok) return res.status(403).json({ error: 'Not allowed' });

    const published = p.status === 'published';
    let goins: number | null = null;
    let publishedAt: Date | null = null;
    let views: number | null = null;
    if (published) {
      const ev: any[] = await (prisma as any).goinsEvent.findMany({
        where: { projectId: pid, userId: p.userId, source: 'PROJECT_APPROVAL' },
        select: { amount: true, createdAt: true },
      });
      if (ev.length) {
        goins = ev.reduce((a, e) => a + (e.amount || 0), 0);
        publishedAt = ev.map((e) => e.createdAt).sort((a, b) => +a - +b)[0];
      }
      const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(p.video?.url || '');
      if (m) {
        try {
          const { getVideoViewCounts } = require('../services/youtubeUploadService');
          const got = await getVideoViewCounts([m[1]]);
          if (typeof got[m[1]] === 'number') views = got[m[1]];
        } catch { /* views stay blank */ }
      }
    }
    return res.json({
      planId: p.planId || null,
      videoCode: p.videoCode || null,
      planCreatedAt: p.planCreatedAt || p.createdAt,
      maker: p.user?.name || '',
      school: p.user?.schoolName || '',
      title: p.title,
      description: p.description,
      category: p.category?.name || '',
      startDate: p.startDate,
      endDate: p.endDate,
      materials: (p.materials || []).map((m: any) => ({ name: m.name || '', quantity: m.quantity })),
      sketch: p.planSketch || null,
      published,
      thumbnail: published ? p.thumbnail : null,
      publishedAt,
      goins,
      views,
    });
  } catch (e: any) {
    console.error('plan-sheet error:', e?.message || e);
    return res.status(500).json({ error: 'Could not load the sheet.' });
  }
});

export default router;
