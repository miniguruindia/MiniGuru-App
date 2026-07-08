import { Request, Response } from 'express';
import prisma from '../../utils/prismaClient';
import logger from '../../logger';

const { setVideoPublic, deleteVideo } = require('../../services/youtubeUploadService');

function extractYouTubeId(videoUrl: string): string {
  const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : videoUrl;
}

// GET /admin/projects/pending
export const getPendingProjects = async (req: Request, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip  = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: { status: 'pending' },
        include: {
          user:     { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.project.count({ where: { status: 'pending' } }),
    ]);

    logger.info(`Admin fetched pending projects: ${total} total`);
    return res.status(200).json({
      projects,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error(`Error fetching pending projects: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch pending projects.' });
  }
};

// Thrown by publishAndAwardProject() so callers (the HTTP route AND the AI
// auto-approve path in projectController.ts) can distinguish "not found" /
// "wrong status" / "YouTube failed" without either caller re-implementing
// the same checks.
export class ApprovalError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApprovalError';
  }
}

// Shared core of "approve a project": publish on YouTube (if it has a video)
// + award Goins split equally across owner and collaborators. Used by the
// admin-triggered approveProject route below AND by the AI auto-approve
// path (confidence >= 0.85 APPROVE) in projectController.ts — both must
// stay in sync, which is exactly why this now lives in one place instead
// of two copies.
export async function publishAndAwardProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new ApprovalError('Project not found.', 404);
  if (project.status !== 'pending') {
    throw new ApprovalError(`Cannot approve — status is '${project.status}', expected 'pending'.`, 400);
  }

  // ── YouTube ───────────────────────────────────────────────────
  if (project.video?.url) {
    try {
      await setVideoPublic(extractYouTubeId(project.video.url));
      logger.info(`YouTube video set to PUBLIC for project ${id}`);
    } catch (ytError) {
      logger.error(`YouTube publish failed: ${(ytError as Error).message}`);
      throw new ApprovalError('Failed to publish on YouTube. Project not approved.', 502);
    }
  } else {
    logger.warn(`Project ${id} has no video URL — skipping YouTube step`);
  }

  // ── Re-calculate material cost in Goins ───────────────────────
  let materialGoins = 0;
  const mats = (project as any).materials as Array<{ productId: string; quantity: number }> | null;
  if (mats && mats.length > 0) {
    const productIds = mats.map(m => m.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true },
    });
    const priceMap = new Map(products.map(p => [p.id, p.price]));
    for (const mat of mats) {
      const rate = priceMap.get(mat.productId) ?? 0;
      materialGoins += rate * mat.quantity;
    }
  }

  const BASE_REWARD    = 50;
  const materialRefund = Math.round(materialGoins * 2);
  const totalGoins     = BASE_REWARD + materialRefund;
  // ─────────────────────────────────────────────────────────────

  // ── Shared/group projects — split equally across owner + collaborators ──
  // Confirmed product decision: always equal split, no custom percentages.
  // Owner absorbs any rounding remainder so Goins are never lost.
  const collaborators = ((project as any).collaborators as
    Array<{ userId: string; name: string }> | null) || [];
  const recipientIds = [project.userId, ...collaborators.map((c) => c.userId)];
  const shareEach   = Math.floor(totalGoins / recipientIds.length);
  const remainder   = totalGoins - shareEach * recipientIds.length;

  const [updated] = await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: { status: 'published' },
    }),
    ...recipientIds.map((recipientId, idx) =>
      prisma.user.update({
        where: { id: recipientId },
        data: { score: { increment: idx === 0 ? shareEach + remainder : shareEach } },
      })
    ),
  ]);

  logger.info(
    `Project ${id} approved. ${totalGoins} Goins split across ${recipientIds.length} ` +
    `recipient(s) (${shareEach} each${remainder > 0 ? `, +${remainder} rounding to owner` : ''}) ` +
    `(base: ${BASE_REWARD}, material refund 2x${Math.round(materialGoins)}: ${materialRefund})`
  );

  return {
    project: updated,
    goinsAwarded: totalGoins,
    breakdown: { base: BASE_REWARD, materialRefund },
    recipients: recipientIds.length,
  };
}

// POST /admin/projects/:id/approve
export const approveProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await publishAndAwardProject(id);
    return res.status(200).json({
      message: 'Project approved and published on YouTube.',
      ...result,
    });
  } catch (error) {
    if (error instanceof ApprovalError) {
      return res.status(error.status).json({ message: error.message });
    }
    logger.error(`Error approving project ${id}: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to approve project.' });
  }
};

// POST /admin/projects/:id/reject
export const rejectProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason = '' } = req.body;
  const deleteFromYouTube = req.query.deleteFromYoutube === 'true';

  try {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    if (project.status !== 'pending') return res.status(400).json({
      message: `Cannot reject — status is '${project.status}', expected 'pending'.`,
    });

    if (deleteFromYouTube && project.video?.url) {
      try {
        await deleteVideo(extractYouTubeId(project.video.url));
        logger.info(`YouTube video deleted for project ${id}`);
      } catch (ytError) {
        logger.warn(`YouTube delete failed (non-fatal): ${(ytError as Error).message}`);
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { status: 'rejected' },
    });

    logger.info(`Project ${id} rejected. Reason: ${reason || 'none'}`);
    return res.status(200).json({ message: 'Project rejected.', project: updated, reason });
  } catch (error) {
    logger.error(`Error rejecting project ${id}: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to reject project.' });
  }
};

// GET /admin/drafts
export const getAllDrafts = async (req: Request, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip  = (page - 1) * limit;

    const [drafts, total] = await Promise.all([
      prisma.project.findMany({
        where: { status: 'draft' },
        include: {
          user:     { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.project.count({ where: { status: 'draft' } }),
    ]);

    logger.info(`Admin fetched drafts: ${total} total`);
    return res.status(200).json({
      drafts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error(`Error fetching drafts: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch drafts.' });
  }
};