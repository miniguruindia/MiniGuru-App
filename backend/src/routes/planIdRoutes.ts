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

export default router;
