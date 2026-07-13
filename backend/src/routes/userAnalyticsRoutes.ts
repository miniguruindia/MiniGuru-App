// backend/src/routes/userAnalyticsRoutes.ts
// Analytics · Badges · Notifications · Profile Photo Upload
// Field names match schema exactly: commentedById, content, likedById

import express from 'express';
import prisma from '../utils/prismaClient';
import logger from '../logger';
import { authenticateToken } from '../middleware/authMiddleware';
import { resolveSubject } from '../middleware/resolveSubject';

const router = express.Router();

// ─── GET /users/me/analytics ──────────────────────────────────────────────────
router.get('/me/analytics', authenticateToken, resolveSubject, async (req: any, res) => {
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
router.get('/me/badges', authenticateToken, resolveSubject, async (req: any, res) => {
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
// Comments/likes on the user's own projects, merged with persisted
// notifications (admin broadcasts, direct messages, AI-review alerts).
router.get('/me/notifications', authenticateToken, resolveSubject, async (req: any, res) => {
  try {
    const userId = req.user?.userId;

    // Get user's project IDs + titles — may be empty for a brand-new
    // account, but that shouldn't hide persisted notifications below.
    const userProjects = await prisma.project.findMany({
      where:  { userId },
      select: { id: true, title: true },
    });

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

    // Persisted notifications — admin broadcasts, direct messages, AI-review
    // alerts (for admins). These replace what used to be separate emails.
    const persisted = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
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
      ...persisted.map((n) => ({
        id:        n.id,
        type:      n.type,
        emoji:     n.emoji,
        message:   n.message,
        link:      n.link,
        read:      n.read,
        createdAt: n.createdAt,
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

// ─── PUT /users/me/notifications/:id/read ─────────────────────────────────────
// Marks one persisted notification (broadcast/direct/AI-alert) as read.
// Comment/like feed items aren't stored notifications, so this only applies
// to ids that actually exist in the Notification collection — silently
// no-ops otherwise rather than erroring, since the caller can't easily tell
// which kind of id it's holding.
router.put('/me/notifications/:id/read', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const result = await prisma.notification.updateMany({
      where: { id, userId }, // userId check — can only mark your own as read
      data: { read: true },
    });
    return res.json({ success: true, updated: result.count });
  } catch (error) {
    logger.error(`PUT /users/me/notifications/:id/read: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to mark notification as read.' });
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
router.get('/me/photo', authenticateToken, resolveSubject, async (req: any, res) => {
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


// ─── GET /users/me/profile ────────────────────────────────────────────────────
router.get('/me/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, age: true,
        parentName: true, parentPhone: true, about: true,
        grade: true, schoolName: true, city: true, interests: true, guardianEmail: true }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (err) { return res.status(500).json({ message: 'Failed to fetch profile' }); }
});

// ─── PUT /users/me/profile ────────────────────────────────────────────────────
router.put('/me/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    const { name, parentName, parentPhone, about, grade, schoolName, city, interests, guardianEmail } = req.body;
    const data: any = {};
    if (name !== undefined)        data.name        = String(name).trim();
    if (parentName !== undefined)  data.parentName  = parentName  ? String(parentName).trim()  : null;
    if (parentPhone !== undefined) data.parentPhone = parentPhone ? String(parentPhone).trim() : null;
    if (about !== undefined)       data.about       = about       ? String(about).trim()       : null;
    if (grade !== undefined)       data.grade       = grade       ? String(grade).trim()       : null;
    if (schoolName !== undefined)  data.schoolName  = schoolName  ? String(schoolName).trim()  : null;
    if (city !== undefined)        data.city        = city        ? String(city).trim()        : null;
    if (Array.isArray(interests))  data.interests   = interests;
    if (guardianEmail !== undefined) data.guardianEmail = guardianEmail ? String(guardianEmail).trim() : null;
    const user = await prisma.user.update({
      where: { id: userId }, data,
      select: { id: true, name: true, parentName: true, parentPhone: true,
                about: true, grade: true, schoolName: true, city: true, interests: true, guardianEmail: true }
    });
    return res.json({ message: 'Profile updated', user });
  } catch (err) { return res.status(500).json({ message: 'Failed to update profile' }); }
});


// ── GET /users/leaderboard ── public, returns top 10 by Goins (user.score) ──
// Also returns caller's rank + score if a valid JWT is present in Authorization header.
router.get('/leaderboard', async (req: any, res: any) => {
  try {
    const top10 = await prisma.user.findMany({
      orderBy: { score: 'desc' },
      take: 10,
      select: { id: true, name: true, score: true },
    });

    const leaderboard = top10.map((u: any, i: number) => {
      const parts = u.name.trim().split(/\s+/);
      const displayName =
        parts.length > 1
          ? `${parts[0]} ${parts[1][0]}.`
          : parts[0];
      return { rank: i + 1, name: displayName, score: u.score };
    });

    // Try to get the caller's rank without requiring auth middleware
    let userRank: number | null = null;
    let userScore: number | null = null;
    const authHeader = req.headers['authorization'] as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(
          authHeader.split(' ')[1],
          process.env.JWT_SECRET
        ) as { userId: string };
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { score: true },
        });
        if (user) {
          userScore = user.score;
          const usersAbove = await prisma.user.count({
            where: { score: { gt: user.score } },
          });
          userRank = usersAbove + 1;
        }
      } catch (_) {
        // No valid token — that's fine, leaderboard is public
      }
    }

    res.json({ leaderboard, userRank, userScore });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;