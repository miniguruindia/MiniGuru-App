import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

function requireAdmin(req: Request, res: Response, next: Function) {
  const role = (req as any).user?.role;
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Any mentor/school/T-LAB/parent account, or an admin, may submit a
// Happening or Challenge. Plain child/individual accounts cannot.
function requireMentorOrAdmin(req: Request, res: Response, next: Function) {
  const u = (req as any).user;
  if (u?.role === 'ADMIN' || u?.role === 'SUPERADMIN' || u?.isMentor === true) {
    return next();
  }
  return res.status(403).json({ error: 'Only school/T-LAB/parent accounts or admins can submit this.' });
}

async function loadSubmitterContext(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isMentor: true, guardianInfo: true },
  });
}

function schoolNameFor(user: { name: string; guardianInfo: any }) {
  return (user.guardianInfo as any)?.institutionName || user.name;
}

// ─────────────────────────────────────────────────────────────────────────
// HAPPENINGS
// ─────────────────────────────────────────────────────────────────────────

// Admin moderation queue — ALL statuses. Must come before any /:id route.
router.get('/admin/happenings', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.happening.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ happenings: items });
  } catch (err) {
    console.error('[happenings] GET /admin/happenings error:', err);
    res.status(500).json({ error: 'Failed to load happenings.' });
  }
});

router.post('/admin/happenings/:id/approve', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const item = await prisma.happening.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedById: (req as any).user.userId, approvedAt: new Date(), rejectionReason: null },
    });
    res.json({ success: true, happening: item });
  } catch (err) {
    console.error('[happenings] approve error:', err);
    res.status(500).json({ error: 'Failed to approve happening.' });
  }
});

router.post('/admin/happenings/:id/reject', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const item = await prisma.happening.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', rejectionReason: req.body.reason || 'Not specified', approvedById: null, approvedAt: null },
    });
    res.json({ success: true, happening: item });
  } catch (err) {
    console.error('[happenings] reject error:', err);
    res.status(500).json({ error: 'Failed to reject happening.' });
  }
});

router.put('/admin/happenings/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const data: any = {};
    if ('title' in body) data.title = body.title;
    if ('description' in body) data.description = body.description;
    if ('date' in body) data.date = new Date(body.date);
    if ('city' in body) data.city = body.city;
    if ('schoolName' in body) data.schoolName = body.schoolName;
    if ('emoji' in body) data.emoji = body.emoji;
    if ('tag' in body) data.tag = body.tag;
    if ('tagColor' in body) data.tagColor = body.tagColor;
    if ('imageUrl' in body) data.imageUrl = body.imageUrl;
    if ('status' in body) data.status = body.status;

    const item = await prisma.happening.update({ where: { id: req.params.id }, data });
    res.json({ success: true, happening: item });
  } catch (err) {
    console.error('[happenings] PUT /admin/happenings/:id error:', err);
    res.status(500).json({ error: 'Failed to update happening.' });
  }
});

router.delete('/admin/happenings/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.happening.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[happenings] delete error:', err);
    res.status(500).json({ error: 'Failed to delete happening.' });
  }
});

// Submit — mentor/school/T-LAB/parent or admin. Admin-authored entries
// auto-approve; everyone else lands in the moderation queue.
router.post('/happenings', authenticateToken, requireMentorOrAdmin, async (req: Request, res: Response) => {
  try {
    const u = (req as any).user;
    const submitter = await loadSubmitterContext(u.userId);
    if (!submitter) return res.status(401).json({ error: 'User not found.' });

    const isAdmin = submitter.role === 'ADMIN' || submitter.role === 'SUPERADMIN';
    const body = req.body || {};

    if (!body.title || !body.description || !body.date) {
      return res.status(400).json({ error: 'title, description, and date are required.' });
    }

    const item = await prisma.happening.create({
      data: {
        title: body.title,
        description: body.description,
        date: new Date(body.date),
        city: body.city || null,
        // School name is ALWAYS auto-filled from the submitter's own
        // account — never typed manually — so it can't be spoofed.
        schoolName: isAdmin ? (body.schoolName || null) : schoolNameFor(submitter),
        emoji: body.emoji || '🏫',
        tag: body.tag || 'Update',
        tagColor: body.tagColor || null,
        imageUrl: body.imageUrl || null,
        status: isAdmin ? 'APPROVED' : 'PENDING',
        submittedById: submitter.id,
        submittedByName: submitter.name,
        approvedById: isAdmin ? submitter.id : null,
        approvedAt: isAdmin ? new Date() : null,
      },
    });

    res.status(201).json({ success: true, happening: item, pendingApproval: !isAdmin });
  } catch (err) {
    console.error('[happenings] POST /happenings error:', err);
    res.status(500).json({ error: 'Failed to submit happening.' });
  }
});

// Public feed — APPROVED only.
router.get('/happenings', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.happening.findMany({
      where: { status: 'APPROVED' },
      orderBy: { date: 'desc' },
      take: 50,
    });
    res.json({ happenings: items });
  } catch (err) {
    console.error('[happenings] GET /happenings error:', err);
    res.status(500).json({ error: 'Failed to load happenings.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// CHALLENGES
// ─────────────────────────────────────────────────────────────────────────

router.get('/admin/challenges', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.challenge.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ challenges: items });
  } catch (err) {
    console.error('[challenges] GET /admin/challenges error:', err);
    res.status(500).json({ error: 'Failed to load challenges.' });
  }
});

router.post('/admin/challenges/:id/approve', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const item = await prisma.challenge.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedById: (req as any).user.userId, approvedAt: new Date(), rejectionReason: null },
    });
    res.json({ success: true, challenge: item });
  } catch (err) {
    console.error('[challenges] approve error:', err);
    res.status(500).json({ error: 'Failed to approve challenge.' });
  }
});

router.post('/admin/challenges/:id/reject', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const item = await prisma.challenge.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', rejectionReason: req.body.reason || 'Not specified', approvedById: null, approvedAt: null },
    });
    res.json({ success: true, challenge: item });
  } catch (err) {
    console.error('[challenges] reject error:', err);
    res.status(500).json({ error: 'Failed to reject challenge.' });
  }
});

router.put('/admin/challenges/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const data: any = {};
    if ('title' in body) data.title = body.title;
    if ('description' in body) data.description = body.description;
    if ('category' in body) data.category = body.category;
    if ('categoryEmoji' in body) data.categoryEmoji = body.categoryEmoji;
    if ('difficulty' in body) data.difficulty = body.difficulty;
    if ('goinsReward' in body) data.goinsReward = Number(body.goinsReward);
    if ('endDate' in body) data.endDate = new Date(body.endDate);
    if ('participants' in body) data.participants = Number(body.participants);
    if ('color' in body) data.color = body.color;
    if ('lifecycleStatus' in body) data.lifecycleStatus = body.lifecycleStatus;
    if ('status' in body) data.status = body.status;
    // Admin can override audience/restriction on ANY submission.
    if ('audience' in body) data.audience = body.audience;
    if ('restrictedToUserId' in body) data.restrictedToUserId = body.restrictedToUserId || null;

    const item = await prisma.challenge.update({ where: { id: req.params.id }, data });
    res.json({ success: true, challenge: item });
  } catch (err) {
    console.error('[challenges] PUT /admin/challenges/:id error:', err);
    res.status(500).json({ error: 'Failed to update challenge.' });
  }
});

router.delete('/admin/challenges/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.challenge.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[challenges] delete error:', err);
    res.status(500).json({ error: 'Failed to delete challenge.' });
  }
});

// Submit — mentor/school/T-LAB/parent or admin. Teacher picks audience:
// 'OWN_SCHOOL' (only children linked under their own account) or 'ALL'.
// Admin-authored challenges are always 'ALL' and auto-approve.
router.post('/challenges', authenticateToken, requireMentorOrAdmin, async (req: Request, res: Response) => {
  try {
    const u = (req as any).user;
    const submitter = await loadSubmitterContext(u.userId);
    if (!submitter) return res.status(401).json({ error: 'User not found.' });

    const isAdmin = submitter.role === 'ADMIN' || submitter.role === 'SUPERADMIN';
    const body = req.body || {};

    if (!body.title || !body.description || !body.category || !body.endDate) {
      return res.status(400).json({ error: 'title, description, category, and endDate are required.' });
    }

    const audience = isAdmin ? 'ALL' : (body.audience === 'OWN_SCHOOL' ? 'OWN_SCHOOL' : 'ALL');

    const item = await prisma.challenge.create({
      data: {
        title: body.title,
        description: body.description,
        category: body.category,
        categoryEmoji: body.categoryEmoji || null,
        difficulty: body.difficulty || 'Medium',
        goinsReward: Number(body.goinsReward) || 100,
        endDate: new Date(body.endDate),
        participants: Number(body.participants) || 0,
        color: body.color || null,
        lifecycleStatus: body.lifecycleStatus || 'upcoming',
        status: isAdmin ? 'APPROVED' : 'PENDING',
        audience,
        restrictedToUserId: audience === 'OWN_SCHOOL' ? submitter.id : null,
        submittedById: submitter.id,
        submittedByName: submitter.name,
        approvedById: isAdmin ? submitter.id : null,
        approvedAt: isAdmin ? new Date() : null,
      },
    });

    res.status(201).json({ success: true, challenge: item, pendingApproval: !isAdmin });
  } catch (err) {
    console.error('[challenges] POST /challenges error:', err);
    res.status(500).json({ error: 'Failed to submit challenge.' });
  }
});

// Public feed — APPROVED + audience-filtered. Auth is optional: guests and
// unlinked children only ever see ALL-audience challenges. A logged-in
// child sees OWN_SCHOOL challenges too, if they're linked under that same
// teacher/school account (via ChildProfile.guardianId).
router.get('/challenges', async (req: Request, res: Response) => {
  try {
    let schoolIds: string[] = [];

    // Best-effort auth check — this route is public, so a missing/invalid
    // token just means "treat as guest", never an error.
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET) as any;
        const childProfile = await prisma.childProfile.findFirst({
          where: { linkedUserId: decoded.userId },
          select: { guardianId: true },
        });
        if (childProfile) schoolIds = [childProfile.guardianId];
      } catch {
        // Invalid/expired token on a public route — fall through as guest.
      }
    }

    const items = await prisma.challenge.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          { audience: 'ALL' },
          { audience: 'OWN_SCHOOL', restrictedToUserId: { in: schoolIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ challenges: items });
  } catch (err) {
    console.error('[challenges] GET /challenges error:', err);
    res.status(500).json({ error: 'Failed to load challenges.' });
  }
});

export default router;
