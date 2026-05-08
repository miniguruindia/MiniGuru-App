"use strict";
// backend/src/routes/userAnalyticsRoutes.ts
// Analytics · Badges · Notifications · Profile Photo Upload
// Field names match schema exactly: commentedById, content, likedById
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const logger_1 = __importDefault(require("../logger"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const resolveSubject_1 = require("../middleware/resolveSubject");
const router = express_1.default.Router();
// ─── GET /users/me/analytics ──────────────────────────────────────────────────
router.get('/me/analytics', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const [videosWatched, ongoingProjects, completedProjects, likesReceived, commentsReceived, user,] = await Promise.all([
            // Videos the user has watched (VideoView table, correct field: userId)
            prismaClient_1.default.videoView.count({ where: { userId } }),
            // Ongoing = pending / submitted
            prismaClient_1.default.project.count({
                where: { userId, status: { in: ['pending', 'submitted'] } },
            }),
            // Completed = approved
            prismaClient_1.default.project.count({
                where: { userId, status: { in: ['approved', 'completed'] } },
            }),
            // Likes received on user's projects (Like.project.userId)
            prismaClient_1.default.like.count({
                where: { project: { userId } },
            }),
            // Comments received on user's projects (Comment uses commentedById, projectId)
            prismaClient_1.default.comment.count({
                where: { project: { userId } },
            }),
            // User score + project count
            prismaClient_1.default.user.findUnique({
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
            totalProjects: user?._count?.projects ?? 0,
            likesReceived,
            commentsReceived,
            score: user?.score ?? 0,
        });
    }
    catch (error) {
        logger_1.default.error(`GET /users/me/analytics: ${error.message}`);
        return res.status(500).json({ message: 'Failed to fetch analytics.' });
    }
});
// ─── GET /users/me/badges ─────────────────────────────────────────────────────
router.get('/me/badges', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const [user, projectCount, videoWatchCount, videoCommentCount, likeCount] = await Promise.all([
            prismaClient_1.default.user.findUnique({
                where: { id: userId },
                select: { score: true },
            }),
            prismaClient_1.default.project.count({ where: { userId } }),
            prismaClient_1.default.videoView.count({ where: { userId } }), // videos watched
            prismaClient_1.default.videoComment.count({ where: { userId } }), // VideoComment (not Comment)
            prismaClient_1.default.like.count({ where: { project: { userId } } }),
        ]);
        const score = user?.score ?? 0;
        const badges = [
            // ── Projects ──
            { id: 'first_project', emoji: '🔧', name: 'First Build',
                desc: 'Submit your first project', earned: projectCount >= 1, category: 'projects' },
            { id: 'builder_5', emoji: '🏗️', name: 'Builder',
                desc: 'Complete 5 projects', earned: projectCount >= 5, category: 'projects' },
            { id: 'architect_10', emoji: '🏛️', name: 'Architect',
                desc: 'Complete 10 projects', earned: projectCount >= 10, category: 'projects' },
            { id: 'prolific_25', emoji: '🌟', name: 'Prolific Maker',
                desc: 'Complete 25 projects', earned: projectCount >= 25, category: 'projects' },
            // ── Goins milestones ──
            { id: 'goins_100', emoji: '🪙', name: 'Tinkerer',
                desc: 'Earn 100 Goins', earned: score >= 100, category: 'goins' },
            { id: 'goins_300', emoji: '💡', name: 'Inventor',
                desc: 'Earn 300 Goins', earned: score >= 300, category: 'goins' },
            { id: 'goins_600', emoji: '⚡', name: 'Innovator',
                desc: 'Earn 600 Goins', earned: score >= 600, category: 'goins' },
            { id: 'goins_1000', emoji: '🚀', name: 'Rocket Maker',
                desc: 'Earn 1,000 Goins', earned: score >= 1000, category: 'goins' },
            // ── Learning ──
            { id: 'explorer_10', emoji: '🎬', name: 'Explorer',
                desc: 'Watch 10 videos', earned: videoWatchCount >= 10, category: 'learning' },
            { id: 'curious_50', emoji: '📚', name: 'Curious Mind',
                desc: 'Watch 50 videos', earned: videoWatchCount >= 50, category: 'learning' },
            // ── Social ──
            { id: 'commenter_10', emoji: '💬', name: 'Chatter',
                desc: 'Post 10 comments on videos', earned: videoCommentCount >= 10, category: 'social' },
            { id: 'popular_50', emoji: '⭐', name: 'Star Maker',
                desc: 'Receive 50 likes on projects', earned: likeCount >= 50, category: 'social' },
        ];
        return res.json({ badges, score, projectCount });
    }
    catch (error) {
        logger_1.default.error(`GET /users/me/badges: ${error.message}`);
        return res.status(500).json({ message: 'Failed to fetch badges.' });
    }
});
// ─── GET /users/me/notifications ─────────────────────────────────────────────
// Comments and likes received on the user's own projects
router.get('/me/notifications', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const userId = req.user?.userId;
        // Get user's project IDs + titles
        const userProjects = await prismaClient_1.default.project.findMany({
            where: { userId },
            select: { id: true, title: true },
        });
        if (userProjects.length === 0) {
            return res.json({ notifications: [] });
        }
        const projectIds = userProjects.map((p) => p.id);
        const projectTitles = Object.fromEntries(userProjects.map((p) => [p.id, p.title]));
        // Comments on user's projects by OTHER users
        // Schema: Comment { commentedById, commentedBy, content, projectId }
        const recentComments = await prismaClient_1.default.comment.findMany({
            where: {
                projectId: { in: projectIds },
                commentedById: { not: userId },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { commentedBy: { select: { name: true } } },
        });
        // Likes on user's projects by OTHER users
        // Schema: Like { likedById, likedBy, projectId }
        const recentLikes = await prismaClient_1.default.like.findMany({
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
                id: c.id,
                type: 'comment',
                emoji: '💬',
                message: `${c.commentedBy.name} commented on "${projectTitles[c.projectId]}"`,
                projectId: c.projectId,
                createdAt: c.createdAt,
            })),
            ...recentLikes.map((l) => ({
                id: l.id,
                type: 'like',
                emoji: '⭐',
                message: `${l.likedBy.name} liked your project "${projectTitles[l.projectId]}"`,
                projectId: l.projectId,
                createdAt: l.createdAt,
            })),
        ]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 20);
        return res.json({ notifications });
    }
    catch (error) {
        logger_1.default.error(`GET /users/me/notifications: ${error.message}`);
        return res.status(500).json({ message: 'Failed to fetch notifications.' });
    }
});
// ─── POST /users/me/photo ─────────────────────────────────────────────────────
// Stores photo as base64 string on user record
// Requires: profilePhoto String? on User model in schema.prisma
router.post('/me/photo', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { photo } = req.body;
        if (!photo || !photo.startsWith('data:image/')) {
            return res.status(400).json({ message: 'Invalid or missing image.' });
        }
        if (photo.length > 700000) {
            return res.status(413).json({ message: 'Image too large. Please use a smaller photo.' });
        }
        await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { profilePhoto: photo },
        });
        return res.json({ success: true });
    }
    catch (error) {
        logger_1.default.error(`POST /users/me/photo: ${error.message}`);
        return res.status(500).json({ message: 'Failed to update photo.' });
    }
});
// ─── GET /users/me/photo ──────────────────────────────────────────────────────
router.get('/me/photo', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            select: { profilePhoto: true },
        });
        return res.json({ photo: user?.profilePhoto ?? null });
    }
    catch (error) {
        return res.status(500).json({ message: 'Failed to fetch photo.' });
    }
});
// ─── GET /users/me/profile ────────────────────────────────────────────────────
router.get('/me/profile', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, age: true,
                parentName: true, parentPhone: true, about: true,
                grade: true, schoolName: true, city: true, interests: true }
        });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        return res.json(user);
    }
    catch (err) {
        return res.status(500).json({ message: 'Failed to fetch profile' });
    }
});
// ─── PUT /users/me/profile ────────────────────────────────────────────────────
router.put('/me/profile', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { name, parentName, parentPhone, about, grade, schoolName, city, interests } = req.body;
        const data = {};
        if (name !== undefined)
            data.name = String(name).trim();
        if (parentName !== undefined)
            data.parentName = parentName ? String(parentName).trim() : null;
        if (parentPhone !== undefined)
            data.parentPhone = parentPhone ? String(parentPhone).trim() : null;
        if (about !== undefined)
            data.about = about ? String(about).trim() : null;
        if (grade !== undefined)
            data.grade = grade ? String(grade).trim() : null;
        if (schoolName !== undefined)
            data.schoolName = schoolName ? String(schoolName).trim() : null;
        if (city !== undefined)
            data.city = city ? String(city).trim() : null;
        if (Array.isArray(interests))
            data.interests = interests;
        const user = await prismaClient_1.default.user.update({
            where: { id: userId }, data,
            select: { id: true, name: true, parentName: true, parentPhone: true,
                about: true, grade: true, schoolName: true, city: true, interests: true }
        });
        return res.json({ message: 'Profile updated', user });
    }
    catch (err) {
        return res.status(500).json({ message: 'Failed to update profile' });
    }
});
exports.default = router;
