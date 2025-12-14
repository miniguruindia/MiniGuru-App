// backend/src/routes/videoRoutes.ts
import express, { Request, Response } from 'express';
import fs from 'fs';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// Import using require for JS modules (until we convert them to TS)
const { upload, uploadToYouTube } = require('../services/youtubeUploadService');
const PendingVideo = require('../models/PendingVideo');

// User uploads video for approval
router.post('/upload', authenticateToken, upload.single('video'), async (req: Request, res: Response) => {
  try {
    const { title, description, category, tags } = req.body;
    const videoFile = req.file;

    if (!videoFile) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    // Save to pending approval queue
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

    // TODO: Send notification to admin

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

// Admin: Get pending videos
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

// Admin: Approve and upload to YouTube
router.post('/approve/:id', authenticateToken, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { privacyStatus = 'public' } = req.body; // 'public', 'unlisted', or 'private'

    const video = await PendingVideo.findById(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.status !== 'pending') {
      return res.status(400).json({ error: 'Video is not pending approval' });
    }

    // Upload to YouTube
    const youtubeResult = await uploadToYouTube(video.localPath, {
      title: video.title,
      description: video.description,
      tags: video.tags,
      privacyStatus,
    });

    // Update video status
    video.status = 'approved';
    video.youtubeVideoId = youtubeResult.videoId;
    video.youtubeUrl = youtubeResult.url;
    video.approvedAt = new Date();
    video.approvedBy = req.user!.id;
    await video.save();

    // TODO: Notify user that their video is live

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

// Admin: Reject video
router.post('/reject/:id', authenticateToken, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const video = await PendingVideo.findById(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete temporary file
    if (fs.existsSync(video.localPath)) {
      fs.unlinkSync(video.localPath);
    }

    video.status = 'rejected';
    video.rejectionReason = reason;
    video.rejectedAt = new Date();
    video.rejectedBy = req.user!.id;
    await video.save();

    // TODO: Notify user of rejection

    res.json({
      success: true,
      message: 'Video rejected',
    });
  } catch (error: any) {
    console.error('Rejection error:', error);
    res.status(500).json({ error: 'Failed to reject video' });
  }
});

// User: Check their video status
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

export default router;