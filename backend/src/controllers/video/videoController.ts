// backend/src/controllers/video/videoController.ts
// COMPLETE VIDEO INTERACTION CONTROLLER

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../../logger';
import { google } from 'googleapis';

const prisma = new PrismaClient();

// YouTube API setup
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

// OAuth2 client for posting comments
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI
);

if (process.env.YOUTUBE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });
}

const youtubeAuth = google.youtube({
  version: 'v3',
  auth: oauth2Client,
});

// ========================================================================
// VIDEO VIEWS
// ========================================================================

export const trackVideoView = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Check if already viewed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingView = await prisma.videoView.findFirst({
      where: {
        videoId,
        userId,
        createdAt: {
          gte: today,
        },
      },
    });

    if (existingView) {
      return res.json({
        success: true,
        message: 'Already counted today',
        alreadyCounted: true,
      });
    }

    // Create new view
    await prisma.videoView.create({
      data: {
        videoId,
        userId,
      },
    });

    // Get total views
    const totalViews = await prisma.videoView.count({
      where: { videoId },
    });

    logger.info(`✅ View tracked: Video ${videoId} by user ${userId}`);

    res.json({
      success: true,
      totalViews,
      alreadyCounted: false,
    });
  } catch (error) {
    logger.error({ error }, '❌ Track view error');
    res.status(500).json({ message: 'Failed to track view' });
  }
};

export const getVideoViews = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    // Get views from our database
    const appViews = await prisma.videoView.count({
      where: { videoId },
    });

    const uniqueViewers = await prisma.videoView.groupBy({
      by: ['userId'],
      where: { videoId },
    });

    // Try to get YouTube views
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
      logger.warn('Could not fetch YouTube views');
    }

    res.json({
      success: true,
      totalViews: youtubeViews || appViews,
      uniqueViewers: uniqueViewers.length,
      appViews,
      youtubeViews,
    });
  } catch (error) {
    logger.error({ error }, '❌ Get views error');
    res.status(500).json({ message: 'Failed to get views' });
  }
};

// ========================================================================
// VIDEO LIKES (5 Categories)
// ========================================================================

export const likeVideo = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { category, liked } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const validCategories = ['aesthetic', 'functional', 'sturdy', 'creative', 'educational'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        message: 'Invalid category',
        validCategories,
      });
    }

    if (liked) {
      await prisma.videoLike.upsert({
        where: {
          videoId_userId_category: {
            videoId,
            userId,
            category,
          },
        },
        update: {
          createdAt: new Date(),
        },
        create: {
          videoId,
          userId,
          category,
        },
      });
      logger.info(`✅ Like added: ${category} for video ${videoId}`);
    } else {
      await prisma.videoLike.deleteMany({
        where: {
          videoId,
          userId,
          category,
        },
      });
      logger.info(`✅ Like removed: ${category} for video ${videoId}`);
    }

    res.json({ success: true, message: 'Like updated successfully' });
  } catch (error) {
    logger.error({ error }, '❌ Like video error');
    res.status(500).json({ message: 'Failed to update like' });
  }
};

export const getUserVideoLikes = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const likes = await prisma.videoLike.findMany({
      where: { videoId, userId },
      select: { category: true },
    });

    const likeMap = {
      aesthetic: false,
      functional: false,
      sturdy: false,
      creative: false,
      educational: false,
    };

    likes.forEach((like) => {
      likeMap[like.category as keyof typeof likeMap] = true;
    });

    res.json(likeMap);
  } catch (error) {
    logger.error({ error }, '❌ Get user likes error');
    res.status(500).json({ message: 'Failed to get user likes' });
  }
};

export const getVideoLikesStats = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const likes = await prisma.videoLike.groupBy({
      by: ['category'],
      where: { videoId },
      _count: {
        category: true,
      },
    });

    const stats = {
      aesthetic: 0,
      functional: 0,
      sturdy: 0,
      creative: 0,
      educational: 0,
    };

    likes.forEach((like) => {
      stats[like.category as keyof typeof stats] = like._count.category;
    });

    res.json({ success: true, likes: stats });
  } catch (error) {
    logger.error({ error }, '❌ Get likes stats error');
    res.status(500).json({ message: 'Failed to get likes stats' });
  }
};

// ========================================================================
// VIDEO COMMENTS (with YouTube sync)
// ========================================================================

export const getVideoComments = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Get comments from our database
    const appComments = await prisma.videoComment.findMany({
      where: { videoId },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Try to get YouTube comments
    let youtubeComments: any[] = [];
    try {
      const response = await youtube.commentThreads.list({
        part: ['snippet'],
        videoId: videoId,
        maxResults: limit,
        order: 'time',
      });

      youtubeComments = response.data.items?.map((item) => ({
        id: item.id,
        userId: 'youtube',
        userName: item.snippet?.topLevelComment?.snippet?.authorDisplayName || 'YouTube User',
        comment: item.snippet?.topLevelComment?.snippet?.textDisplay || '',
        createdAt: item.snippet?.topLevelComment?.snippet?.publishedAt || new Date().toISOString(),
        source: 'youtube',
        likeCount: item.snippet?.topLevelComment?.snippet?.likeCount || 0,
      })) || [];
    } catch (ytError) {
      logger.warn('Could not fetch YouTube comments');
    }

    // Format app comments
    const formattedAppComments = appComments.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user.name,
      comment: c.comment,
      createdAt: c.createdAt.toISOString(),
      source: 'app',
      postedToYouTube: c.postedToYouTube,
    }));

    // Combine and sort
    const allComments = [...formattedAppComments, ...youtubeComments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(allComments.slice(0, limit));
  } catch (error) {
    logger.error({ error }, '❌ Get comments error');
    res.status(500).json({ message: 'Failed to get comments' });
  }
};

export const postVideoComment = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { comment } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }

    if (comment.length > 500) {
      return res.status(400).json({ message: 'Comment too long (max 500 characters)' });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Save to database
    const newComment = await prisma.videoComment.create({
      data: {
        videoId,
        userId,
        comment: comment.trim(),
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    // Try to post to YouTube (optional)
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

      await prisma.videoComment.update({
        where: { id: newComment.id },
        data: {
          postedToYouTube: true,
          youtubeCommentId,
        },
      });

      logger.info(`✅ Comment posted to YouTube: ${youtubeCommentId}`);
    } catch (ytError) {
      logger.warn('Could not post to YouTube, saved locally only');
    }

    res.status(201).json({
      id: newComment.id,
      userId: newComment.userId,
      userName: newComment.user.name,
      comment: newComment.comment,
      createdAt: newComment.createdAt.toISOString(),
      postedToYouTube: !!youtubeCommentId,
    });
  } catch (error) {
    logger.error({ error }, '❌ Post comment error');
    res.status(500).json({ message: 'Failed to post comment' });
  }
};

export const deleteVideoComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const comment = await prisma.videoComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await prisma.videoComment.delete({
      where: { id: commentId },
    });

    logger.info(`✅ Comment deleted: ${commentId}`);

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    logger.error({ error }, '❌ Delete comment error');
    res.status(500).json({ message: 'Failed to delete comment' });
  }
};