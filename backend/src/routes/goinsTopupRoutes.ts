// backend/src/routes/goinsTopupRoutes.ts
import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Only admins may use these — checks role fresh from DB, same pattern as materialsRoutes.ts
function requireAdmin(req: Request, res: Response, next: Function) {
  const role = (req as any).user?.role;
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Allows EITHER an admin OR a mentor (parent/teacher) who is the guardian
// of the child making the request. Looks everything up fresh — safe even
// though req.user doesn't carry isMentor by default.
async function requireAdminOrGuardianMentor(req: any, res: Response, next: Function) {
  try {
    const actingUserId = req.user?.userId;
    const acting = await prisma.user.findUnique({
      where: { id: actingUserId },
      select: { role: true, isMentor: true },
    });

    if (acting?.role === 'ADMIN' || acting?.role === 'SUPERADMIN') {
      req.actingRole = 'ADMIN';
      return next();
    }

    if (acting?.isMentor === true) {
      // Confirm this mentor is actually the guardian of the requester
      const { id } = req.params;
      const request = await prisma.goinTopUpRequest.findUnique({ where: { id } });
      if (!request) return res.status(404).json({ error: 'Request not found' });

      const isGuardian = await prisma.childProfile.findFirst({
        where: {
          guardianId: actingUserId,
          OR: [
            { linkedUserId: request.requesterId },
            { id: request.requesterId },
          ],
        },
      });

      if (isGuardian) {
        req.actingRole = 'MENTOR';
        return next();
      }
    }

    return res.status(403).json({ error: 'Not authorized to act on this request' });
  } catch (err) {
    console.error('requireAdminOrGuardianMentor error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

// ─── POST /goins/topup/request — child hits a shortfall while planning ──────
router.post('/topup/request', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { amount, reason, projectDraftContext } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const request = await prisma.goinTopUpRequest.create({
      data: {
        requesterId: userId,
        requesterName: user?.name ?? 'Unknown',
        amount,
        reason: reason || null,
        projectDraftContext: projectDraftContext || null,
        status: 'PENDING',
      },
    });

    return res.json({ success: true, request });
  } catch (err) {
    console.error('POST /goins/topup/request error:', err);
    return res.status(500).json({ error: 'Failed to create request' });
  }
});

// ─── GET /goins/topup/mine — child checks status of their own requests ──────
router.get('/topup/mine', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const requests = await prisma.goinTopUpRequest.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ requests });
  } catch (err) {
    console.error('GET /goins/topup/mine error:', err);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// ─── GET /admin/goins/topup/pending — admin sees ALL pending requests ───────
router.get('/admin/topup/pending', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const pending = await prisma.goinTopUpRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ requests: pending });
  } catch (err) {
    console.error('GET /admin/goins/topup/pending error:', err);
    return res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// ─── GET /mentor/goins/topup/pending — mentor sees only THEIR children's requests ──
router.get('/mentor/topup/pending', authenticateToken, async (req: any, res: Response) => {
  try {
    const guardianId = req.user?.userId;
    const children = await prisma.childProfile.findMany({
      where: { guardianId },
      select: { id: true, linkedUserId: true },
    });
    const requesterIds = children.flatMap(c => [c.id, c.linkedUserId]).filter(Boolean) as string[];

    if (requesterIds.length === 0) return res.json({ requests: [] });

    const pending = await prisma.goinTopUpRequest.findMany({
      where: { status: 'PENDING', requesterId: { in: requesterIds } },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ requests: pending });
  } catch (err) {
    console.error('GET /mentor/topup/pending error:', err);
    return res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// ─── POST /admin/goins/topup/:id/approve ─────────────────────────────────────
router.post('/admin/topup/:id/approve', authenticateToken, requireAdminOrGuardianMentor, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const actingUserId = req.user?.userId;
    const actingRole = req.actingRole || 'ADMIN';

    const request = await prisma.goinTopUpRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request not pending' });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: request.requesterId },
        data: { score: { increment: request.amount } },
      }),
      prisma.goinTopUpRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          decidedById: actingUserId,
          decidedByRole: actingRole,
          decidedAt: new Date(),
        },
      }),
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /admin/topup/:id/approve error:', err);
    return res.status(500).json({ error: 'Failed to approve request' });
  }
});

// ─── POST /admin/goins/topup/:id/deny ────────────────────────────────────────
router.post('/admin/topup/:id/deny', authenticateToken, requireAdminOrGuardianMentor, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { denialReason } = req.body;
    const actingUserId = req.user?.userId;
    const actingRole = req.actingRole || 'ADMIN';

    await prisma.goinTopUpRequest.update({
      where: { id },
      data: {
        status: 'DENIED',
        decidedById: actingUserId,
        decidedByRole: actingRole,
        decidedAt: new Date(),
        denialReason: denialReason || null,
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /admin/topup/:id/deny error:', err);
    return res.status(500).json({ error: 'Failed to deny request' });
  }
});

export default router;