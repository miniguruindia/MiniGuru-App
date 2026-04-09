"use strict";
// backend/src/routes/videoRoutes.ts
// COMPLETE UNIFIED FILE - Handles uploads AND interactions
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
// Video interaction controllers
const videoController_1 = require("../controllers/video/videoController");
const router = express_1.default.Router();
// Import upload service (JS module)
const { upload, uploadToYouTube } = require('../services/youtubeUploadService');
// ========================================================================
// SECTION 1: VIDEO UPLOAD ROUTES (Admin workflow)
// ========================================================================
router.post('/upload', authMiddleware_1.authenticateToken, upload.single('video'), async (req, res) => {
    try {
        const { title, description, category, tags, privacyStatus } = req.body;
        const videoFile = req.file;
        if (!videoFile) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }
        const pendingVideo = await prismaClient_1.default.pendingVideo.create({
            data: {
                title,
                description,
                category: category?.toUpperCase().replace(/\s+/g, '_') || 'SHOW_PIECE',
                tags: tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
                localPath: videoFile.path,
                originalName: videoFile.originalname,
                fileSize: videoFile.size,
                mimeType: videoFile.mimetype,
                uploadedById: req.user.id,
                status: 'PENDING',
                privacyStatus: privacyStatus || 'public',
                submittedAt: new Date(),
                auditTrail: {
                    create: {
                        action: 'SUBMITTED',
                        actionById: req.user.id,
                        notes: `Video submitted for approval by ${req.user.id}`,
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
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload video', details: error.message });
    }
});
router.get('/pending', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const pendingVideos = await prismaClient_1.default.pendingVideo.findMany({
            where: { status: 'PENDING' },
            orderBy: { submittedAt: 'desc' },
            include: { auditTrail: { orderBy: { timestamp: 'desc' }, take: 1 } },
        });
        res.json({
            success: true,
            count: pendingVideos.length,
            videos: pendingVideos,
        });
    }
    catch (error) {
        console.error('Error fetching pending videos:', error);
        res.status(500).json({ error: 'Failed to fetch pending videos' });
    }
});
router.post('/approve/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { privacyStatus = 'public' } = req.body;
        const video = await prismaClient_1.default.pendingVideo.findUnique({ where: { id } });
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
        await prismaClient_1.default.pendingVideo.update({
            where: { id },
            data: {
                status: 'APPROVED',
                youtubeVideoId: youtubeResult.videoId,
                youtubeUrl: youtubeResult.url,
                approvalNotes: approvalNotes,
                approvedAt: new Date(),
                approvedById: req.user.id,
                auditTrail: {
                    create: {
                        action: 'APPROVED',
                        actionById: req.user.id,
                        notes: approvalNotes || `Approved by ${req.user.id}`,
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
    }
    catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({ error: 'Failed to approve video', details: error.message });
    }
});
router.post('/reject/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const video = await prismaClient_1.default.pendingVideo.findUnique({ where: { id } });
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        if (fs_1.default.existsSync(video.localPath)) {
            fs_1.default.unlinkSync(video.localPath);
        }
        await prismaClient_1.default.pendingVideo.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason: reason,
                rejectedAt: new Date(),
                rejectedById: req.user.id,
                auditTrail: {
                    create: {
                        action: 'REJECTED',
                        actionById: req.user.id,
                        notes: `Rejected by ${req.user.id}`,
                        changesSummary: reason || 'No reason provided',
                    },
                },
            },
        });
        res.json({
            success: true,
            message: 'Video rejected',
        });
    }
    catch (error) {
        console.error('Rejection error:', error);
        res.status(500).json({ error: 'Failed to reject video' });
    }
});
router.get('/my-submissions', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const videos = await prismaClient_1.default.pendingVideo.findMany({
            where: { uploadedById: req.user.id },
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
    }
    catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});
// ========================================================================
// SECTION 2: VIDEO INTERACTION ROUTES (Views, Likes, Comments)
// ========================================================================
// Video views
router.post('/:videoId/view', authMiddleware_1.authenticateToken, videoController_1.trackVideoView);
router.get('/:videoId/views', videoController_1.getVideoViews);
// Video likes (5 categories)
router.post('/:videoId/like', authMiddleware_1.authenticateToken, videoController_1.likeVideo);
router.get('/:videoId/likes/user', authMiddleware_1.authenticateToken, videoController_1.getUserVideoLikes);
router.get('/:videoId/likes/stats', videoController_1.getVideoLikesStats);
// Video comments
router.get('/:videoId/comments', videoController_1.getVideoComments);
router.post('/:videoId/comments', authMiddleware_1.authenticateToken, videoController_1.postVideoComment);
router.delete('/comments/:commentId', authMiddleware_1.authenticateToken, videoController_1.deleteVideoComment);
exports.default = router;
