import { Request, Response } from 'express';
import prisma from '../../utils/prismaClient';
import logger from '../../logger';

const { setVideoPublic, setVideoPrivate, deleteVideo, checkVideoStatus } = require('../../services/youtubeUploadService');

export function extractYouTubeId(videoUrl: string): string {
  const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
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
  // 'rejected' is allowed here too — admin can change their mind (or a
  // video that was fixed via the admin edit page's video-replace feature
  // needs re-approving). Only 'published' (already live) is blocked.
  if (!['pending', 'rejected'].includes(project.status)) {
    throw new ApprovalError(`Cannot approve — status is '${project.status}', expected 'pending' or 'rejected'.`, 400);
  }

  // ── Fresh YouTube status check, right before publishing (Sept 2026) ──
  // Content ID matching isn't instant, so the snapshot taken right after
  // upload is usually stale by the time an admin gets around to
  // approving — this is the moment it actually matters, so re-check here,
  // every time, rather than trusting whatever was last stored. A genuine
  // 'rejected'/'failed'/'deleted' result (which is how a full-block
  // Content ID claim — status.rejectionReason === 'claim' — surfaces via
  // the public API) blocks the approval outright: publishing over a video
  // YouTube itself has already rejected would either fail anyway or leave
  // admin believing something is live that isn't. A region restriction
  // alone does NOT block approval — that's visible in the admin badge but
  // left to the admin's judgement, since a video can be entirely
  // legitimate and still be restricted in specific territories.
  // Never let a FAILED CHECK itself block anything — only a genuine
  // positive result from YouTube does.
  let freshYtStatus: { uploadStatus?: string | null; statusReason?: string | null; regionsBlocked?: number | null; checkedAt?: Date | null } | null = null;
  if (checkVideoStatus && project.video?.url) {
    try {
      freshYtStatus = await checkVideoStatus(extractYouTubeId(project.video.url));
    } catch (statusError) {
      logger.warn(`YouTube status re-check failed before approval (non-fatal, proceeding): ${(statusError as Error).message}`);
    }
  }
  if (freshYtStatus && ['rejected', 'failed', 'deleted'].includes(freshYtStatus.uploadStatus || '')) {
    // Persist what we found even though we're about to block — admin
    // needs to see the reason in the queue without re-clicking Check.
    await prisma.project.update({
      where: { id },
      data: {
        youtubeUploadStatus: freshYtStatus.uploadStatus,
        youtubeStatusReason: freshYtStatus.statusReason,
        youtubeRegionsBlocked: freshYtStatus.regionsBlocked,
        youtubeStatusCheckedAt: freshYtStatus.checkedAt,
      },
    }).catch(() => {});
    throw new ApprovalError(
      `YouTube itself reports this video as '${freshYtStatus.uploadStatus}'` +
      (freshYtStatus.statusReason ? ` (${freshYtStatus.statusReason})` : '') +
      ' — cannot approve until this is resolved (check the video directly on YouTube).',
      409,
    );
  }
  // Clean (or check unavailable) — still worth persisting a fresh
  // timestamp/snapshot so the admin queue reflects the latest check even
  // after approval, without blocking anything.
  if (freshYtStatus) {
    await prisma.project.update({
      where: { id },
      data: {
        youtubeUploadStatus: freshYtStatus.uploadStatus,
        youtubeStatusReason: freshYtStatus.statusReason,
        youtubeRegionsBlocked: freshYtStatus.regionsBlocked,
        youtubeStatusCheckedAt: freshYtStatus.checkedAt,
      },
    }).catch(() => {});
  }

  // ── YouTube ───────────────────────────────────────────────────
  // Respect the uploader's own privacy-status choice from upload time —
  // "PRIVATE" means never go Public on YouTube, no matter what review
  // decides. This is what actually gives the choice real effect, not
  // just a cosmetic form field.
  // ── YouTube ───────────────────────────────────────────────────
  // Respect the uploader's own privacy-status choice from upload time —
  // this is what actually gives the choice real effect on YouTube itself,
  // not just a cosmetic form field. Every video starts Unlisted (so it's
  // reviewable by link); this step applies the final, user-chosen state
  // once review has passed:
  //   PUBLIC   → videos.update privacyStatus=public
  //   UNLISTED → no call needed, already Unlisted from upload
  //   PRIVATE  → videos.update privacyStatus=private (a real, distinct
  //              YouTube state — not merely "we never publish it")
  const status = project.desiredPrivacyStatus || 'PUBLIC';
  if (!project.video?.url) {
    logger.warn(`Project ${id} has no video URL — skipping YouTube step`);
  } else if (status === 'PUBLIC') {
    try {
      await setVideoPublic(extractYouTubeId(project.video.url));
      logger.info(`YouTube video set to PUBLIC for project ${id}`);
    } catch (ytError) {
      logger.error(`YouTube publish failed: ${(ytError as Error).message}`);
      throw new ApprovalError('Failed to publish on YouTube. Project not approved.', 502);
    }
  } else if (status === 'PRIVATE') {
    try {
      await setVideoPrivate(extractYouTubeId(project.video.url));
      logger.info(`YouTube video set to PRIVATE for project ${id} (uploader's choice)`);
    } catch (ytError) {
      logger.error(`YouTube set-private failed: ${(ytError as Error).message}`);
      throw new ApprovalError('Failed to apply Private status on YouTube. Project not approved.', 502);
    }
  } else {
    // UNLISTED — already the state every video starts in; nothing to do.
    logger.info(`Project ${id} uploader chose UNLISTED — staying as-is, not publishing.`);
  }

  // ── Re-calculate material cost in Goins ───────────────────────
  // BUGFIX: this used to query prisma.product — the old own-shop model
  // from before the Amazon-affiliate architecture (Rule 26). No Material
  // ID has ever matched a Product ID, so this lookup silently returned
  // empty every single time, meaning materialGoins was ALWAYS 0 and the
  // "2x materials refund" bonus has never actually paid out on any
  // project, ever. Confirmed against a real account's exact numbers.
  let materialGoins = 0;
  const mats = (project as any).materials as Array<{ productId: string; quantity: number }> | null;
  if (mats && mats.length > 0) {
    const materialIds = mats.map(m => m.productId);
    const materialRecords = await prisma.material.findMany({
      where: { id: { in: materialIds } },
      select: { id: true, goinsPrice: true },
    });
    const priceMap = new Map(materialRecords.map(m => [m.id, m.goinsPrice]));
    for (const mat of mats) {
      const rate = priceMap.get(mat.productId) ?? 0;
      materialGoins += rate * mat.quantity;
    }
  }

  const BASE_REWARD    = 50;
  const materialRefund = Math.round(materialGoins * 2);

  // ── STEAM Challenge bonus — in ADDITION to the normal award ─────────────
  // If this project was made for a challenge (set at upload time — see
  // createProject), the challenge's goinsReward is paid out on top of the
  // base + material refund, once, here, on approval. Never re-awarded on
  // a re-approval attempt since a project can only be approved from
  // 'pending' once (see the status guard above).
  let challengeBonus = 0;
  if (project.challengeId) {
    try {
      const challenge = await prisma.challenge.findUnique({ where: { id: project.challengeId } });
      if (challenge) challengeBonus = challenge.goinsReward;
    } catch (challengeError) {
      logger.warn(`Challenge lookup failed during approval, awarding base only: ${(challengeError as Error).message}`);
    }
  }

  const totalGoins = BASE_REWARD + materialRefund + challengeBonus;
  // ─────────────────────────────────────────────────────────────

  // ── Shared/group projects — split equally across owner + collaborators ──
  // Confirmed product decision: always equal split, no custom percentages.
  // Owner absorbs any rounding remainder so Goins are never lost. The
  // challenge bonus is folded into totalGoins above, so it's split the
  // exact same way — a team that joins a challenge together shares the
  // bonus equally too, same as the base award.
  const collaborators = ((project as any).collaborators as
    Array<{ userId: string; name: string }> | null) || [];
  const recipientIds = [project.userId, ...collaborators.map((c) => c.userId)];
  const shareEach   = Math.floor(totalGoins / recipientIds.length);
  const remainder   = totalGoins - shareEach * recipientIds.length;

  const reasonParts = [`base +${BASE_REWARD}`];
  if (materialRefund > 0) reasonParts.push(`materials +${materialRefund}`);
  if (challengeBonus > 0) reasonParts.push(`challenge bonus +${challengeBonus}`);
  const isTeam = recipientIds.length > 1;

  const [updated] = await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: {
        status: 'published',
        challengeGoinsAwarded: challengeBonus > 0 ? challengeBonus : undefined,
      },
    }),
    ...recipientIds.map((recipientId, idx) => {
      const share = idx === 0 ? shareEach + remainder : shareEach;
      const reason = `"${project.title}" approved: +${share} Goins ` +
        `(${reasonParts.join(', ')}${isTeam ? `, split ${recipientIds.length} ways` : ''})`;
      return prisma.user.update({
        where: { id: recipientId },
        data: {
          score: { increment: share },
          // updatedScore stores the DELTA of this transaction (matching
          // the existing convention already used by /admin/goins/adjust
          // and read by /admin/goins/history) — NOT the resulting total.
          scoreHistory: { push: { time: new Date(), updatedScore: share, reason } },
        },
      });
    }),
  ]);

  logger.info(
    `Project ${id} approved. ${totalGoins} Goins split across ${recipientIds.length} ` +
    `recipient(s) (${shareEach} each${remainder > 0 ? `, +${remainder} rounding to owner` : ''}) ` +
    `(base: ${BASE_REWARD}, material refund 2x${Math.round(materialGoins)}: ${materialRefund}` +
    `${challengeBonus > 0 ? `, challenge bonus: ${challengeBonus}` : ''})`
  );

  return {
    project: updated,
    goinsAwarded: totalGoins,
    breakdown: { base: BASE_REWARD, materialRefund, challengeBonus },
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

// POST /admin/projects/:id/youtube-check — on-demand re-poll of YouTube's
// own reported status for this project's video, surfaced as a badge next
// to the AI verdict on the admin queue (see checkVideoStatus() in
// youtubeUploadService.js for exactly what this can and can't detect —
// short version: a full block/claim rejection, yes; a claim that just
// tracks/monetizes without blocking, no, that's Content Manager-only).
// Does NOT approve/reject/publish anything by itself — purely informational,
// same spirit as the AI badge. The one place a status check DOES change
// approval behaviour is the automatic re-check inside publishAndAwardProject
// above, right before it would actually publish.
export const checkYoutubeStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const project = await prisma.project.findUnique({ where: { id }, select: { video: true } });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    if (!project.video?.url) return res.status(400).json({ message: 'This project has no video to check.' });

    const result = await checkVideoStatus(extractYouTubeId(project.video.url));

    const updated = await prisma.project.update({
      where: { id },
      data: {
        youtubeUploadStatus: result.uploadStatus,
        youtubeStatusReason: result.statusReason,
        youtubeRegionsBlocked: result.regionsBlocked,
        youtubeStatusCheckedAt: result.checkedAt,
      },
      select: {
        youtubeUploadStatus: true, youtubeStatusReason: true,
        youtubeRegionsBlocked: true, youtubeStatusCheckedAt: true,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    logger.error(`Error checking YouTube status for project ${id}: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Could not check YouTube status. Please try again.' });
  }
};