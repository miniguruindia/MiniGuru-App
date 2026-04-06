// backend/src/routes/videoRoutes.ts
// COMPLETE UNIFIED FILE - Handles uploads AND interactions

import express, { Request, Response } from 'express';
import fs from 'fs';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';
import prisma from '../utils/prismaClient';

// Video interaction controllers
import {
  trackVideoView,
  getVideoViews,
  likeVideo,
  getUserVideoLikes,
  getVideoLikesStats,
  getVideoComments,
  postVideoComment,
  deleteVideoComment,
} from '../controllers/video/videoController';

const router = express.Router();

// Import upload service (JS module)
const { upload, uploadToYouTube } = require('../services/youtubeUploadService');

// ========================================================================
// SECTION 1: VIDEO UPLOAD ROUTES (Admin workflow)
// ========================================================================

router.post('/upload', authenticateToken, upload.single('video'), async (req: Request, res: Response) => {
  try {
    const { title, description, category, tags, privacyStatus } = req.body;
    const videoFile = req.file;

    if (!videoFile) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const pendingVideo = await prisma.pendingVideo.create({
      data: {
        title,
        description,
        category: category?.toUpperCase().replace(/\s+/g, '_') || 'SHOW_PIECE',
        tags: tags ? tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
        localPath: videoFile.path,
        originalName: videoFile.originalname,
        fileSize: videoFile.size,
        mimeType: videoFile.mimetype,
        uploadedById: req.user!.id,
        status: 'PENDING',
        privacyStatus: privacyStatus || 'public',
        submittedAt: new Date(),
        auditTrail: {
          create: {
            action: 'SUBMITTED',
            actionById: req.user!.id,
            notes: `Video submitted for approval by ${req.user!.id}`,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Video submitted for approval',
      videoId: pendingVideo.id,
      estimatedReviewTime: '24-48 hours',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload video', details: error.message });
  }
});

router.get('/pending', authenticateToken, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const pendingVideos = await prisma.pendingVideo.findMany({
      where: { status: 'PENDING' },
      orderBy: { submittedAt: 'desc' },
      include: { auditTrail: { orderBy: { timestamp: 'desc' }, take: 1 } },
    });

    res.json({
      success: true,
      count: pendingVideos.length,
      videos: pendingVideos,
    });
  } catch (error: any) {
    console.error('Error fetching pending videos:', error);
    res.status(500).json({ error: 'Failed to fetch pending videos' });
  }
});

router.post('/approve/:id', authenticateToken, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { privacyStatus = 'public' } = req.body;

    const video = await prisma.pendingVideo.findUnique({ where: { id } });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.status !== 'PENDING') {
      return res.status(400).json({ error: 'Video is not pending approval' });
    }

    const { approvalNotes } = req.body;

    const youtubeResult = await uploadToYouTube(video.localPath, {
      title: video.title,
      description: video.description,
      tags: video.tags,
      privacyStatus: video.privacyStatus,
    });

    await prisma.pendingVideo.update({
      where: { id },
      data: {
        status: 'APPROVED',
        youtubeVideoId: youtubeResult.videoId,
        youtubeUrl: youtubeResult.url,
        approvalNotes: approvalNotes,
        approvedAt: new Date(),
        approvedById: req.user!.id,
        auditTrail: {
          create: {
            action: 'APPROVED',
            actionById: req.user!.id,
            notes: approvalNotes || `Approved by ${req.user!.id}`,
            changesSummary: `Uploaded to YouTube: ${youtubeResult.videoId}`,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Video approved and uploaded to YouTube',
      youtubeUrl: youtubeResult.url,
      videoId: youtubeResult.videoId,
    });
  } catch (error: any) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to approve video', details: error.message });
  }
});

router.post('/reject/:id', authenticateToken, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const video = await prisma.pendingVideo.findUnique({ where: { id } });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (fs.existsSync(video.localPath)) {
      fs.unlinkSync(video.localPath);
    }

    await prisma.pendingVideo.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedById: req.user!.id,
        auditTrail: {
          create: {
            action: 'REJECTED',
            actionById: req.user!.id,
            notes: `Rejected by ${req.user!.id}`,
            changesSummary: reason || 'No reason provided',
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Video rejected',
    });
  } catch (error: any) {
    console.error('Rejection error:', error);
    res.status(500).json({ error: 'Failed to reject video' });
  }
});

router.get('/my-submissions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const videos = await prisma.pendingVideo.findMany({
      where: { uploadedById: req.user!.id },
      orderBy: { submittedAt: 'desc' },
      include: { auditTrail: { orderBy: { timestamp: 'desc' }, take: 5 } },
    });

    res.json({
      success: true,
      videos: videos.map((v) => ({
        id: v.id,
        title: v.title,
        status: v.status,
        submittedAt: v.submittedAt,
        youtubeUrl: v.youtubeUrl,
        rejectionReason: v.rejectionReason,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// ========================================================================
// SECTION 2: VIDEO INTERACTION ROUTES (Views, Likes, Comments)
// ========================================================================

// Video views
router.post('/:videoId/view', authenticateToken, trackVideoView);
router.get('/:videoId/views', getVideoViews);

// Video likes (5 categories)
router.post('/:videoId/like', authenticateToken, likeVideo);
router.get('/:videoId/likes/user', authenticateToken, getUserVideoLikes);
router.get('/:videoId/likes/stats', getVideoLikesStats);

// Video comments
router.get('/:videoId/comments', getVideoComments);
router.post('/:videoId/comments', authenticateToken, postVideoComment);
router.delete('/comments/:commentId', authenticateToken, deleteVideoComment);

export default router;