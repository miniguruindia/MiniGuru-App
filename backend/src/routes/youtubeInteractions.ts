// backend/src/routes/youtubeInteractions.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import prisma from '../utils/prismaClient';
import logger from '../logger';
import { google } from 'googleapis';

const router = Router();

// YouTube API setup
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

// OAuth2 client for posting comments (requires authentication)
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI
);

// Set refresh token (get this once from OAuth flow)
if (process.env.YOUTUBE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });
}

const youtubeAuth = google.youtube({
  version: 'v3',
  auth: oauth2Client,
});

// ==================== TRACK VIDEO VIEW ====================
router.post('/track-view', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.body;
    const userId = req.user?.id;

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    // Check if user already viewed this video today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingView = await prisma.videoView.findFirst({
      where: {
        videoId,
        userId,
        viewedAt: {
          gte: today,
        },
      },
    });

    if (existingView) {
      return res.json({ 
        success: true, 
        message: 'Already counted today',
        alreadyCounted: true 
      });
    }

    // Record view in database
    await prisma.videoView.create({
      data: {
        videoId,
        userId: userId!,
        viewedAt: new Date(),
      },
    });

    // Get total view count for this video
    const totalViews = await prisma.videoView.count({
      where: { videoId },
    });

    logger.info(`View tracked: Video ${videoId} by user ${userId}`);

    res.json({ 
      success: true, 
      totalViews,
      alreadyCounted: false
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to track view');
    res.status(500).json({ error: 'Failed to track view' });
  }
});

// ==================== GET VIEW COUNT ====================
router.get('/views/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    // Get view count from our database
    const appViews = await prisma.videoView.count({
      where: { videoId },
    });

    // Get view count from YouTube
    let youtubeViews = 0;
    try {
      const response = await youtube.videos.list({
        part: ['statistics'],
        id: [videoId],
      });

      youtubeViews = parseInt(
        response.data.items?.[0]?.statistics?.viewCount || '0'
      );
    } catch (ytError) {
      logger.error({ error: ytError instanceof Error ? ytError.message : 'Unknown error' }, 'Failed to get YouTube views');
    }

    res.json({
      success: true,
      appViews,
      youtubeViews,
      totalViews: youtubeViews,
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get view count');
    res.status(500).json({ error: 'Failed to get view count' });
  }
});

// ==================== POST COMMENT ====================
router.post('/comments', authenticateToken, async (req, res) => {
  try {
    const { videoId, comment } = req.body;
    const userId = req.user?.id;

    if (!videoId || !comment) {
      return res.status(400).json({ error: 'videoId and comment are required' });
    }

    if (comment.trim().length === 0) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Save comment in our database
    const savedComment = await prisma.videoComment.create({
      data: {
        videoId,
        userId: userId!,
        comment: comment.trim(),
        postedAt: new Date(),
        postedToYouTube: false,
      },
    });

    // Try to post to YouTube (this requires OAuth)
    let youtubeCommentId: string | null = null;
    try {
      const response = await youtubeAuth.commentThreads.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            videoId: videoId,
            topLevelComment: {
              snippet: {
                textOriginal: `${comment.trim()}\n\n- ${user.name} (via MiniGuru App)`,
              },
            },
          },
        },
      });

      youtubeCommentId = response.data.id || null;

      // Update database to mark as posted to YouTube
      await prisma.videoComment.update({
        where: { id: savedComment.id },
        data: {
          postedToYouTube: true,
          youtubeCommentId,
        },
      });

      logger.info(`Comment posted to YouTube: ${youtubeCommentId}`);
    } catch (ytError) {
      logger.error({ error: ytError instanceof Error ? ytError.message : 'Unknown error' }, 'Failed to post comment to YouTube');
      // Comment is still saved in our database even if YouTube posting fails
    }

    res.json({
      success: true,
      comment: {
        id: savedComment.id,
        videoId,
        comment: savedComment.comment,
        userName: user.name,
        postedAt: savedComment.postedAt,
        postedToYouTube: !!youtubeCommentId,
      },
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to post comment');
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// ==================== GET COMMENTS ====================
router.get('/comments/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    // Get comments from our database
    const appComments = await prisma.videoComment.findMany({
      where: { videoId },
      include: {
        user: {
          select: {
            name: true,
            id: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
      take: limit,
    });

    // Get comments from YouTube
    let youtubeComments: any[] = [];
    try {
      const response = await youtube.commentThreads.list({
        part: ['snippet'],
        videoId: videoId,
        maxResults: limit,
        order: 'time',
      });

      youtubeComments = response.data.items?.map(item => ({
        id: item.id,
        author: item.snippet?.topLevelComment?.snippet?.authorDisplayName,
        comment: item.snippet?.topLevelComment?.snippet?.textDisplay,
        postedAt: item.snippet?.topLevelComment?.snippet?.publishedAt,
        likeCount: item.snippet?.topLevelComment?.snippet?.likeCount,
        source: 'youtube',
      })) || [];
    } catch (ytError) {
      logger.error({ error: ytError instanceof Error ? ytError.message : 'Unknown error' }, 'Failed to get YouTube comments');
    }

    // Format app comments
    const formattedAppComments = appComments.map(c => ({
      id: c.id,
      author: c.user.name,
      comment: c.comment,
      postedAt: c.postedAt,
      likeCount: 0,
      source: 'app',
      postedToYouTube: c.postedToYouTube,
    }));

    // Combine and sort by date
    const allComments = [...formattedAppComments, ...youtubeComments].sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    );

    res.json({
      success: true,
      comments: allComments.slice(0, limit),
      totalAppComments: appComments.length,
      totalYouTubeComments: youtubeComments.length,
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get comments');
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// ==================== DELETE COMMENT (APP ONLY) ====================
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;

    // Check if comment belongs to user
    const comment = await prisma.videoComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Delete from database
    await prisma.videoComment.delete({
      where: { id: commentId },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to delete comment');
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;