// backend/src/routes/schoolJoinRoutes.ts
// Child -> school join requests (Oct 2026). Mounted at /school-join.
//   child:  GET /school-lookup?loginId=   POST /request   GET /mine   POST /:id/cancel
//   school: GET /pending                  POST /:id/approve   POST /:id/decline
// Approving creates the same ChildProfile link as "Add existing child"; the
// child keeps their own account, Goins and projects.
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';
import { notifyUser } from '../services/notificationService';

const router = Router();
router.use(authenticateToken);

function normaliseLoginId(raw: any): string {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  return v.includes('@') ? v : v + '@miniguru.in';
}

function schoolLabel(u: { name: string; guardianInfo: any }): string {
  return (u.guardianInfo && u.guardianInfo.institutionName) || u.name;
}

async function loadMe(req: Request) {
  const id = (req as any).user?.id;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, age: true, role: true, isMentor: true, email: true },
  });
}

async function findSchool(loginId: string) {
  const school = await prisma.user.findUnique({
    where: { email: loginId },
    select: { id: true, name: true, isMentor: true, mentorType: true, guardianInfo: true },
  });
  if (!school || !school.isMentor || !(school.mentorType === 'SCHOOL' || school.mentorType === 'TLAB')) return null;
  return school;
}

// GET /school-join/school-lookup?loginId=sunrise.ujjain
router.get('/school-lookup', async (req: Request, res: Response) => {
  try {
    const loginId = normaliseLoginId(req.query.loginId);
    if (!loginId) return res.status(400).json({ message: "Enter your school's login ID" });
    const school = await findSchool(loginId);
    if (!school) return res.status(404).json({ message: 'No school found with that login ID. Ask your teacher for it.' });
    return res.json({ schoolName: schoolLabel(school), city: school.guardianInfo?.city ?? null });
  } catch (e: any) {
    console.error('school lookup error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /school-join/request { loginId }
router.post('/request', async (req: Request, res: Response) => {
  try {
    const me = await loadMe(req);
    if (!me || me.role !== 'USER' || me.isMentor) return res.status(403).json({ message: 'Only learner accounts can ask to join a school' });
    const loginId = normaliseLoginId(req.body?.loginId);
    const school = loginId ? await findSchool(loginId) : null;
    if (!school) return res.status(404).json({ message: 'No school found with that login ID. Ask your teacher for it.' });

    const inSchool = await prisma.childProfile.findFirst({ where: { linkedUserId: me.id, isActive: true }, select: { id: true } });
    if (inSchool) return res.status(400).json({ message: 'You are already in a school or family list.' });

    const pendingAll = await prisma.schoolJoinRequest.count({ where: { childUserId: me.id, status: 'PENDING' } });
    if (pendingAll >= 3) return res.status(400).json({ message: 'You already have 3 waiting requests. Cancel one first.' });
    const dup = await prisma.schoolJoinRequest.findFirst({ where: { childUserId: me.id, schoolId: school.id, status: 'PENDING' } });
    if (dup) return res.status(400).json({ message: 'You already asked this school. Please wait for the teacher.' });

    const reqRow = await prisma.schoolJoinRequest.create({ data: { childUserId: me.id, schoolId: school.id } });
    try {
      await notifyUser({
        userId: school.id,
        type: 'school_join_request',
        emoji: '🏫',
        message: `${me.name} wants to join your school. Open your learner list to approve or decline.`,
      });
    } catch (e) { /* best effort */ }
    return res.status(201).json({ message: 'Request sent', id: reqRow.id, schoolName: schoolLabel(school) });
  } catch (e: any) {
    console.error('join request error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /school-join/mine -> is the child already in a school, and their open requests
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const me = await loadMe(req);
    if (!me) return res.status(401).json({ message: 'Unauthorized' });
    const link = await prisma.childProfile.findFirst({ where: { linkedUserId: me.id, isActive: true }, select: { guardianId: true } });
    let inSchool: { name: string } | null = null;
    if (link) {
      const g = await prisma.user.findUnique({ where: { id: link.guardianId }, select: { name: true, mentorType: true, guardianInfo: true } });
      if (g) inSchool = { name: schoolLabel(g) };
    }
    const rows = await prisma.schoolJoinRequest.findMany({
      where: { childUserId: me.id, status: { in: ['PENDING', 'DECLINED'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const schools = rows.length
      ? await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.schoolId) } }, select: { id: true, name: true, guardianInfo: true } })
      : [];
    const nameOf = new Map<string, string>(schools.map((s: any) => [s.id, schoolLabel(s)]));
    return res.json({
      isMentor: me.isMentor,
      inSchool,
      requests: rows.map((r) => ({ id: r.id, status: r.status, schoolName: nameOf.get(r.schoolId) || 'School', createdAt: r.createdAt })),
    });
  } catch (e: any) {
    console.error('join mine error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /school-join/:id/cancel (child)
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const me = await loadMe(req);
    const row = await prisma.schoolJoinRequest.findUnique({ where: { id: req.params.id } });
    if (!me || !row || row.childUserId !== me.id || row.status !== 'PENDING') return res.status(404).json({ message: 'Request not found' });
    await prisma.schoolJoinRequest.update({ where: { id: row.id }, data: { status: 'CANCELLED', decidedAt: new Date() } });
    return res.json({ message: 'Request cancelled' });
  } catch (e: any) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /school-join/pending (school)
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const me = await loadMe(req);
    if (!me || !me.isMentor) return res.json({ requests: [] });
    const rows = await prisma.schoolJoinRequest.findMany({ where: { schoolId: me.id, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 100 });
    const kids = rows.length
      ? await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.childUserId) } }, select: { id: true, name: true, age: true, email: true } })
      : [];
    const kid = new Map<string, any>(kids.map((k: any) => [k.id, k]));
    return res.json({
      requests: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        childName: kid.get(r.childUserId)?.name ?? 'Child',
        childAge: kid.get(r.childUserId)?.age ?? null,
        loginId: kid.get(r.childUserId)?.email ?? null,
      })),
    });
  } catch (e: any) {
    console.error('join pending error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

async function loadOwnPending(req: Request) {
  const me = await loadMe(req);
  if (!me || !me.isMentor) return { me: null as any, row: null as any };
  const row = await prisma.schoolJoinRequest.findUnique({ where: { id: req.params.id } });
  if (!row || row.schoolId !== me.id || row.status !== 'PENDING') return { me, row: null as any };
  return { me, row };
}

// POST /school-join/:id/approve (school)
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { me, row } = await loadOwnPending(req);
    if (!row) return res.status(404).json({ message: 'Request not found or already handled' });
    const child = await prisma.user.findUnique({ where: { id: row.childUserId }, select: { id: true, name: true, age: true, role: true, isMentor: true } });
    if (!child || child.role !== 'USER' || child.isMentor) return res.status(400).json({ message: 'This account can no longer be added.' });
    const active = await prisma.childProfile.findFirst({ where: { linkedUserId: child.id, isActive: true }, select: { id: true } });
    if (active) {
      await prisma.schoolJoinRequest.update({ where: { id: row.id }, data: { status: 'DECLINED', decidedAt: new Date() } });
      return res.status(400).json({ message: 'This child is already linked to a school or family list.' });
    }
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const pinHash = await bcrypt.hash(pin, 10);
    const earlier = await prisma.childProfile.findFirst({ where: { guardianId: me.id, linkedUserId: child.id }, select: { id: true } });
    const select = { id: true, name: true, age: true, grade: true, score: true, isActive: true, createdAt: true } as const;
    const profile = earlier
      ? await prisma.childProfile.update({ where: { id: earlier.id }, data: { isActive: true, pinHash }, select })
      : await prisma.childProfile.create({ data: { guardianId: me.id, name: child.name, age: child.age, pinHash, linkedUserId: child.id }, select });
    await prisma.schoolJoinRequest.update({ where: { id: row.id }, data: { status: 'APPROVED', decidedAt: new Date() } });
    // other waiting requests from this child are now moot
    await prisma.schoolJoinRequest.updateMany({
      where: { childUserId: child.id, status: 'PENDING' },
      data: { status: 'CANCELLED', decidedAt: new Date() },
    });
    try {
      await notifyUser({ userId: child.id, type: 'school_join_approved', emoji: '🎉', message: 'Your school accepted you! You are now in their learner list.' });
    } catch (e) { /* best effort */ }
    return res.json({ message: 'Child added', child: profile, pin });
  } catch (e: any) {
    console.error('join approve error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /school-join/:id/decline (school)
router.post('/:id/decline', async (req: Request, res: Response) => {
  try {
    const { row } = await loadOwnPending(req);
    if (!row) return res.status(404).json({ message: 'Request not found or already handled' });
    await prisma.schoolJoinRequest.update({ where: { id: row.id }, data: { status: 'DECLINED', decidedAt: new Date() } });
    try {
      await notifyUser({ userId: row.childUserId, type: 'school_join_declined', emoji: '🏫', message: 'The school did not accept your request. You can check the login ID or ask your teacher.' });
    } catch (e) { /* best effort */ }
    return res.json({ message: 'Request declined' });
  } catch (e: any) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
