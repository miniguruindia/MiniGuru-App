// backend/src/routes/userAnalyticsRoutes.ts
// Analytics · Badges · Notifications · Profile Photo Upload
// Field names match schema exactly: commentedById, content, likedById

import express from 'express';
import prisma from '../utils/prismaClient';
import logger from '../logger';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// ─── GET /users/me/analytics ──────────────────────────────────────────────────
router.get('/me/analytics', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;

    const [
      videosWatched,
      ongoingProjects,
      completedProjects,
      likesReceived,
      commentsReceived,
      user,
    ] = await Promise.all([
      // Videos the user has watched (VideoView table, correct field: userId)
      prisma.videoView.count({ where: { userId } }),

      // Ongoing = pending / submitted
      prisma.project.count({
        where: { userId, status: { in: ['pending', 'submitted'] } },
      }),

      // Completed = approved
      prisma.project.count({
        where: { userId, status: { in: ['approved', 'completed'] } },
      }),

      // Likes received on user's projects (Like.project.userId)
      prisma.like.count({
        where: { project: { userId } },
      }),

      // Comments received on user's projects (Comment uses commentedById, projectId)
      prisma.comment.count({
        where: { project: { userId } },
      }),

      // User score + project count
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          score: true,
          _count: { select: { projects: true } },
        },
      }),
    ]);

    return res.json({
      videosWatched,
      ongoingProjects,
      completedProjects,
      totalProjects:    user?._count?.projects ?? 0,
      likesReceived,
      commentsReceived,
      score:            user?.score ?? 0,
    });
  } catch (error) {
    logger.error(`GET /users/me/analytics: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch analytics.' });
  }
});

// ─── GET /users/me/badges ─────────────────────────────────────────────────────
router.get('/me/badges', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;

    const [user, projectCount, videoWatchCount, videoCommentCount, likeCount] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { score: true },
        }),
        prisma.project.count({ where: { userId } }),
        prisma.videoView.count({ where: { userId } }),       // videos watched
        prisma.videoComment.count({ where: { userId } }),    // VideoComment (not Comment)
        prisma.like.count({ where: { project: { userId } } }),
      ]);

    const score = user?.score ?? 0;

    const badges = [
      // ── Projects ──
      { id: 'first_project', emoji: '🔧', name: 'First Build',
        desc: 'Submit your first project',    earned: projectCount >= 1,  category: 'projects' },
      { id: 'builder_5',     emoji: '🏗️', name: 'Builder',
        desc: 'Complete 5 projects',          earned: projectCount >= 5,  category: 'projects' },
      { id: 'architect_10',  emoji: '🏛️', name: 'Architect',
        desc: 'Complete 10 projects',         earned: projectCount >= 10, category: 'projects' },
      { id: 'prolific_25',   emoji: '🌟', name: 'Prolific Maker',
        desc: 'Complete 25 projects',         earned: projectCount >= 25, category: 'projects' },

      // ── Goins milestones ──
      { id: 'goins_100',  emoji: '🪙', name: 'Tinkerer',
        desc: 'Earn 100 Goins',     earned: score >= 100,  category: 'goins' },
      { id: 'goins_300',  emoji: '💡', name: 'Inventor',
        desc: 'Earn 300 Goins',     earned: score >= 300,  category: 'goins' },
      { id: 'goins_600',  emoji: '⚡', name: 'Innovator',
        desc: 'Earn 600 Goins',     earned: score >= 600,  category: 'goins' },
      { id: 'goins_1000', emoji: '🚀', name: 'Rocket Maker',
        desc: 'Earn 1,000 Goins',   earned: score >= 1000, category: 'goins' },

      // ── Learning ──
      { id: 'explorer_10', emoji: '🎬', name: 'Explorer',
        desc: 'Watch 10 videos',    earned: videoWatchCount >= 10, category: 'learning' },
      { id: 'curious_50',  emoji: '📚', name: 'Curious Mind',
        desc: 'Watch 50 videos',    earned: videoWatchCount >= 50, category: 'learning' },

      // ── Social ──
      { id: 'commenter_10', emoji: '💬', name: 'Chatter',
        desc: 'Post 10 comments on videos', earned: videoCommentCount >= 10, category: 'social' },
      { id: 'popular_50',   emoji: '⭐', name: 'Star Maker',
        desc: 'Receive 50 likes on projects', earned: likeCount >= 50,       category: 'social' },
    ];

    return res.json({ badges, score, projectCount });
  } catch (error) {
    logger.error(`GET /users/me/badges: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch badges.' });
  }
});

// ─── GET /users/me/notifications ─────────────────────────────────────────────
// Comments and likes received on the user's own projects
router.get('/me/notifications', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;

    // Get user's project IDs + titles
    const userProjects = await prisma.project.findMany({
      where:  { userId },
      select: { id: true, title: true },
    });

    if (userProjects.length === 0) {
      return res.json({ notifications: [] });
    }

    const projectIds    = userProjects.map((p) => p.id);
    const projectTitles = Object.fromEntries(
      userProjects.map((p) => [p.id, p.title])
    );

    // Comments on user's projects by OTHER users
    // Schema: Comment { commentedById, commentedBy, content, projectId }
    const recentComments = await prisma.comment.findMany({
      where: {
        projectId:     { in: projectIds },
        commentedById: { not: userId },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { commentedBy: { select: { name: true } } },
    });

    // Likes on user's projects by OTHER users
    // Schema: Like { likedById, likedBy, projectId }
    const recentLikes = await prisma.like.findMany({
      where: {
        projectId: { in: projectIds },
        likedById: { not: userId },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { likedBy: { select: { name: true } } },
    });

    const notifications = [
      ...recentComments.map((c) => ({
        id:        c.id,
        type:      'comment',
        emoji:     '💬',
        message:   `${c.commentedBy.name} commented on "${projectTitles[c.projectId]}"`,
        projectId: c.projectId,
        createdAt: c.createdAt,
      })),
      ...recentLikes.map((l) => ({
        id:        l.id,
        type:      'like',
        emoji:     '⭐',
        message:   `${l.likedBy.name} liked your project "${projectTitles[l.projectId]}"`,
        projectId: l.projectId,
        createdAt: l.createdAt,
      })),
    ]
      .sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 20);

    return res.json({ notifications });
  } catch (error) {
    logger.error(`GET /users/me/notifications: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

// ─── POST /users/me/photo ─────────────────────────────────────────────────────
// Stores photo as base64 string on user record
// Requires: profilePhoto String? on User model in schema.prisma
router.post('/me/photo', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const { photo } = req.body;

    if (!photo || !photo.startsWith('data:image/')) {
      return res.status(400).json({ message: 'Invalid or missing image.' });
    }
    if (photo.length > 700_000) {
      return res.status(413).json({ message: 'Image too large. Please use a smaller photo.' });
    }

    await (prisma.user as any).update({
      where: { id: userId },
      data:  { profilePhoto: photo },
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error(`POST /users/me/photo: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to update photo.' });
  }
});

// ─── GET /users/me/photo ──────────────────────────────────────────────────────
router.get('/me/photo', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const user   = await (prisma.user as any).findUnique({
      where:  { id: userId },
      select: { profilePhoto: true },
    });
    return res.json({ photo: user?.profilePhoto ?? null });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch photo.' });
  }
});

export default router;