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

// POST /admin/projects/:id/approve
export const approveProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    if (project.status !== 'pending') return res.status(400).json({
      message: `Cannot approve — status is '${project.status}', expected 'pending'.`,
    });

    if (project.video?.url) {
      try {
        await setVideoPublic(extractYouTubeId(project.video.url));
        logger.info(`YouTube video set to PUBLIC for project ${id}`);
      } catch (ytError) {
        logger.error(`YouTube publish failed: ${(ytError as Error).message}`);
        return res.status(502).json({
          message: 'Failed to publish on YouTube. Project not approved.',
          error: (ytError as Error).message,
        });
      }
    } else {
      logger.warn(`Project ${id} has no video URL — skipping YouTube step`);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { status: 'published' },
    });

    logger.info(`Project ${id} approved`);
    return res.status(200).json({ message: 'Project approved and published on YouTube.', project: updated });
  } catch (error) {
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
