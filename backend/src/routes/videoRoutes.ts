// backend/src/routes/videoRoutes.ts
// COMPLETE UNIFIED FILE - Handles uploads AND interactions

import express, { Request, Response } from 'express';
import fs from 'fs';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';

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
const PendingVideo = require('../models/PendingVideo');

// ========================================================================
// SECTION 1: VIDEO UPLOAD ROUTES (Admin workflow)
// ========================================================================

router.post('/upload', authenticateToken, upload.single('video'), async (req: Request, res: Response) => {
  try {
    const { title, description, category, tags } = req.body;
    const videoFile = req.file;

    if (!videoFile) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const pendingVideo = await PendingVideo.create({
      title,
      description,
      category,
      tags: tags ? tags.split(',') : [],
      localPath: videoFile.path,
      originalName: videoFile.originalname,
      fileSize: videoFile.size,
      mimeType: videoFile.mimetype,
      uploadedBy: req.user!.id,
      status: 'pending',
      submittedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Video submitted for approval',
      videoId: pendingVideo._id,
      estimatedReviewTime: '24-48 hours',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload video', details: error.message });
  }
});

router.get('/pending', authenticateToken, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const pendingVideos = await PendingVideo.find({ status: 'pending' })
      .populate('uploadedBy', 'name email')
      .sort({ submittedAt: -1 });

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

    const video = await PendingVideo.findById(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.status !== 'pending') {
      return res.status(400).json({ error: 'Video is not pending approval' });
    }

    const youtubeResult = await uploadToYouTube(video.localPath, {
      title: video.title,
      description: video.description,
      tags: video.tags,
      privacyStatus,
    });

    video.status = 'approved';
    video.youtubeVideoId = youtubeResult.videoId;
    video.youtubeUrl = youtubeResult.url;
    video.approvedAt = new Date();
    video.approvedBy = req.user!.id;
    await video.save();

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

    const video = await PendingVideo.findById(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (fs.existsSync(video.localPath)) {
      fs.unlinkSync(video.localPath);
    }

    video.status = 'rejected';
    video.rejectionReason = reason;
    video.rejectedAt = new Date();
    video.rejectedBy = req.user!.id;
    await video.save();

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
    const videos = await PendingVideo.find({ uploadedBy: req.user!.id })
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      videos: videos.map((v: any) => ({
        id: v._id,
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