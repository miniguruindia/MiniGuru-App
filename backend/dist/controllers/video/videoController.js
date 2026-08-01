"use strict";
// backend/src/controllers/video/videoController.ts
// COMPLETE VIDEO INTERACTION CONTROLLER
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCommentToYouTube = exports.listCommentsForModeration = exports.deleteVideoComment = exports.updateVideoComment = exports.postVideoComment = exports.getVideoComments = exports.getVideoLikesStats = exports.getUserVideoLikes = exports.likeVideo = exports.getVideoViews = exports.trackVideoView = void 0;
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../../logger"));
const googleapis_1 = require("googleapis");
const resolveSubject_1 = require("../../middleware/resolveSubject");
const prisma = new client_1.PrismaClient();
// YouTube API setup
const youtube = googleapis_1.google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
});
// OAuth2 client for posting comments
const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, process.env.YOUTUBE_REDIRECT_URI);
if (process.env.YOUTUBE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
        refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });
}
const youtubeAuth = googleapis_1.google.youtube({
    version: 'v3',
    auth: oauth2Client,
});
// ========================================================================
// VIDEO VIEWS
// ========================================================================
// Minimum fraction of the video the client must report as watched before
// the view Goin is credited. Slightly below the Flutter-side 0.75 trigger
// to tolerate float/timing drift between the player's progress stream and
// this request landing — NOT a separate, looser threshold.
const MIN_WATCHED_FRACTION_FOR_GOIN = 0.7;
const trackVideoView = async (req, res) => {
    try {
        const { videoId } = req.params;
        const userId = req.user?.userId; // ✅ FIXED: was req.user?.id
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        // BUGFIX (Goins-farming exploit): this endpoint used to be called the
        // instant playback started, with zero regard for how much was actually
        // watched — kids learned that just opening a video and scrolling away
        // earned a Goin. The client now only calls this once real watch
        // progress crosses ~75% (see unifiedVideoPlayer.dart); this server-side
        // check is defense-in-depth so an outdated/bypassed client can't just
        // call the endpoint immediately. This is inherently a client-reported
        // signal — a technically sophisticated user could still fake the
        // number — but it fully closes the casual "open and scroll past" exploit
        // that was actually happening.
        const watchedFraction = Number(req.body?.watchedFraction);
        if (!Number.isFinite(watchedFraction) || watchedFraction < MIN_WATCHED_FRACTION_FOR_GOIN) {
            return res.status(400).json({
                message: 'View not counted yet — keep watching.',
                code: 'INSUFFICIENT_WATCH_PROGRESS',
                required: MIN_WATCHED_FRACTION_FOR_GOIN,
            });
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
        // +1 Goin to viewer for watching (once per video per day)
        await prisma.user.update({
            where: { id: userId },
            data: { score: { increment: 1 } },
        }).catch(() => { });
        // Get total views
        const totalViews = await prisma.videoView.count({
            where: { videoId },
        });
        logger_1.default.info(`✅ View tracked: Video ${videoId} by user ${userId}`);
        res.json({
            success: true,
            totalViews,
            alreadyCounted: false,
        });
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Track view error');
        res.status(500).json({ message: 'Failed to track view' });
    }
};
exports.trackVideoView = trackVideoView;
const getVideoViews = async (req, res) => {
    try {
        const { videoId } = req.params;
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
            youtubeViews = parseInt(response.data.items?.[0]?.statistics?.viewCount || '0');
        }
        catch (ytError) {
            logger_1.default.warn('Could not fetch YouTube views');
        }
        res.json({
            success: true,
            totalViews: youtubeViews || appViews,
            uniqueViewers: uniqueViewers.length,
            appViews,
            youtubeViews,
        });
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Get views error');
        res.status(500).json({ message: 'Failed to get views' });
    }
};
exports.getVideoViews = getVideoViews;
// ========================================================================
// VIDEO LIKES (5 Categories)
// ========================================================================
const likeVideo = async (req, res) => {
    try {
        const { videoId } = req.params;
        const { category, liked } = req.body;
        // BUGFIX: was req.user?.userId directly — a mentor browsing inside a
        // child's PIN session would have their own account credited with the
        // like instead of the child's. resolveOwnerUserId (requires
        // resolveSubject on the route) correctly resolves to the child's own
        // linked account when a child session is active.
        const userId = (0, resolveSubject_1.resolveOwnerUserId)(req, res);
        if (!userId)
            return; // resolveOwnerUserId already sent the error response
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
            logger_1.default.info(`✅ Like added: ${category} for video ${videoId}`);
        }
        else {
            await prisma.videoLike.deleteMany({
                where: {
                    videoId,
                    userId,
                    category,
                },
            });
            logger_1.default.info(`✅ Like removed: ${category} for video ${videoId}`);
        }
        res.json({ success: true, message: 'Like updated successfully' });
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Like video error');
        res.status(500).json({ message: 'Failed to update like' });
    }
};
exports.likeVideo = likeVideo;
const getUserVideoLikes = async (req, res) => {
    try {
        const { videoId } = req.params;
        // Same resolution as likeVideo — must check the SAME account that
        // likeVideo would have recorded the like under.
        const userId = (0, resolveSubject_1.resolveOwnerUserId)(req, res);
        if (!userId)
            return;
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
            likeMap[like.category] = true;
        });
        res.json(likeMap);
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Get user likes error');
        res.status(500).json({ message: 'Failed to get user likes' });
    }
};
exports.getUserVideoLikes = getUserVideoLikes;
const getVideoLikesStats = async (req, res) => {
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
            stats[like.category] = like._count.category;
        });
        res.json({ success: true, likes: stats });
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Get likes stats error');
        res.status(500).json({ message: 'Failed to get likes stats' });
    }
};
exports.getVideoLikesStats = getVideoLikesStats;
// ========================================================================
// VIDEO COMMENTS (with YouTube sync)
// ========================================================================
const getVideoComments = async (req, res) => {
    try {
        const { videoId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
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
        let youtubeComments = [];
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
        }
        catch (ytError) {
            logger_1.default.warn('Could not fetch YouTube comments');
        }
        const formattedAppComments = appComments.map((c) => ({
            id: c.id,
            userId: c.userId,
            userName: c.user.name,
            comment: c.comment,
            createdAt: c.createdAt.toISOString(),
            source: 'app',
            postedToYouTube: c.postedToYouTube,
        }));
        const allComments = [...formattedAppComments, ...youtubeComments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json(allComments.slice(0, limit));
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Get comments error');
        res.status(500).json({ message: 'Failed to get comments' });
    }
};
exports.getVideoComments = getVideoComments;
// Max comments a single child can POST (as new comments) per video. Beyond
// this, they must edit one of their existing comments (PUT /comments/:id)
// instead of creating a new one. Fixes a real Goins-farming exploit: kids
// learned that any comment earned +1 Goin and started posting unlimited
// nonsense comments to farm it.
const MAX_COMMENTS_PER_VIDEO = 2;
// Goins the VIDEO MAKER(S) earn when someone comments on their project —
// split equally across owner + collaborators, same convention as
// publishAndAwardProject / videoRatingRoutes. Previously the maker got
// nothing at all when their video was commented on.
const COMMENT_GOINS_TO_MAKER = 2;
// The `videoId` used for comments/views/likes is the raw YouTube video id
// (see unifiedVideoPlayer.dart — widget.videoId, NOT widget.projectId,
// is what's passed to these endpoints), not the Project's own DB id. To
// pay the video's maker(s), we need to resolve back to the owning Project.
// Same two-step lookup already proven by GET /:videoId/materials above:
// 1) PendingVideo.youtubeVideoId (legacy upload path), then
// 2) fall back to matching Project.video.url by substring.
async function resolveProjectForVideoId(videoId) {
    try {
        const pendingVideo = await prisma.pendingVideo.findFirst({
            where: { youtubeVideoId: videoId },
            select: { uploadedById: true },
        });
        if (pendingVideo?.uploadedById) {
            const project = await prisma.project.findFirst({
                where: { userId: pendingVideo.uploadedById },
                orderBy: { createdAt: 'desc' },
                select: { id: true, userId: true, collaborators: true },
            });
            if (project)
                return project;
        }
    }
    catch (_) { /* fall through to the URL-match fallback below */ }
    try {
        const candidates = await prisma.project.findMany({
            where: { status: { in: ['approved', 'published'] } },
            select: { id: true, userId: true, collaborators: true, video: true },
            orderBy: { createdAt: 'desc' },
            take: 300,
        });
        return candidates.find((p) => p.video?.url && p.video.url.includes(videoId)) || null;
    }
    catch (_) {
        return null;
    }
}
async function awardCommentGoinsToMaker(videoId, commenterId) {
    const project = await resolveProjectForVideoId(videoId);
    if (!project)
        return; // e.g. an Outside Video with no matching Project — nobody to pay, that's fine
    const collaborators = project.collaborators || [];
    // Exclude the commenter from recipients in case they're commenting on
    // their own (or a co-owned) project — no self-payout for a comment.
    const recipientIds = [project.userId, ...collaborators.map((c) => c.userId)]
        .filter((id) => id !== commenterId);
    if (recipientIds.length === 0)
        return;
    const shareEach = Math.floor(COMMENT_GOINS_TO_MAKER / recipientIds.length);
    const remainder = COMMENT_GOINS_TO_MAKER - shareEach * recipientIds.length;
    await prisma.$transaction(recipientIds.map((id, idx) => prisma.user.update({
        where: { id },
        data: { score: { increment: idx === 0 ? shareEach + remainder : shareEach } },
    })));
}
const postVideoComment = async (req, res) => {
    try {
        const { videoId } = req.params;
        const { comment } = req.body;
        // BUGFIX: was req.user?.userId directly — a child's comment posted
        // during a mentor's PIN session would show the MENTOR's name, not the
        // child's. Resolve to the real acting account first.
        const userId = (0, resolveSubject_1.resolveOwnerUserId)(req, res);
        if (!userId)
            return;
        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ message: 'Comment cannot be empty' });
        }
        if (comment.length > 500) {
            return res.status(400).json({ message: 'Comment too long (max 500 characters)' });
        }
        // Comment cap — the actual fix for the Goins-farming exploit. Once a
        // child has posted MAX_COMMENTS_PER_VIDEO comments on this video, they
        // must edit an existing one (PUT /comments/:id) instead of posting a
        // new one. Edits never earn additional Goins (see updateVideoComment).
        const existingCount = await prisma.videoComment.count({ where: { videoId, userId } });
        if (existingCount >= MAX_COMMENTS_PER_VIDEO) {
            return res.status(429).json({
                message: `You've already commented ${MAX_COMMENTS_PER_VIDEO} times on this video. ` +
                    `Edit one of your existing comments instead of posting a new one.`,
                code: 'COMMENT_LIMIT_REACHED',
                limit: MAX_COMMENTS_PER_VIDEO,
            });
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
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
        // +1 Goin to commenter for engaging with community (capped by the
        // MAX_COMMENTS_PER_VIDEO check above — max 2 Goins per video this way).
        await prisma.user.update({
            where: { id: userId },
            data: { score: { increment: 1 } },
        }).catch(() => { }); // non-blocking — don't fail comment if Goins fail
        // The video's maker(s) earn Goins too now — previously only the
        // commenter did, the maker got nothing from being commented on.
        await awardCommentGoinsToMaker(videoId, userId).catch((e) => logger_1.default.warn({ e }, '⚠️ Could not award comment Goins to video maker'));
        // BEHAVIOR CHANGE (founder request): comments no longer auto-post to
        // YouTube on creation. They're saved locally only; postedToYouTube
        // stays false until an admin explicitly approves + pushes it via
        // POST /admin/comments/:id/post-to-youtube. This lets admin moderate
        // out spam/nonsense before it ever reaches the public YouTube video.
        res.status(201).json({
            id: newComment.id,
            userId: newComment.userId,
            userName: newComment.user.name,
            comment: newComment.comment,
            createdAt: newComment.createdAt.toISOString(),
            postedToYouTube: false,
            commentsUsed: existingCount + 1,
            commentsRemaining: MAX_COMMENTS_PER_VIDEO - (existingCount + 1),
        });
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Post comment error');
        res.status(500).json({ message: 'Failed to post comment' });
    }
};
exports.postVideoComment = postVideoComment;
const updateVideoComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { comment } = req.body;
        // Must resolve to the SAME account postVideoComment would have used,
        // so a child editing during a mentor's PIN session still edits their
        // own comment, not a new/wrong one.
        const userId = (0, resolveSubject_1.resolveOwnerUserId)(req, res);
        if (!userId)
            return;
        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ message: 'Comment cannot be empty' });
        }
        if (comment.length > 500) {
            return res.status(400).json({ message: 'Comment too long (max 500 characters)' });
        }
        const existing = await prisma.videoComment.findUnique({ where: { id: commentId } });
        if (!existing) {
            return res.status(404).json({ message: 'Comment not found' });
        }
        if (existing.userId !== userId) {
            return res.status(403).json({ message: 'Not authorized to edit this comment' });
        }
        // No Goins on edit — this is the escape valve for the comment cap, not
        // a second earning opportunity. If it had already been pushed to
        // YouTube by an admin, the YouTube copy is now stale text — reset the
        // flag so it drops back into the admin queue rather than silently
        // showing outdated text on the public video.
        const updated = await prisma.videoComment.update({
            where: { id: commentId },
            data: {
                comment: comment.trim(),
                postedToYouTube: false,
                youtubeCommentId: null,
            },
            include: { user: { select: { id: true, name: true } } },
        });
        res.json({
            id: updated.id,
            userId: updated.userId,
            userName: updated.user.name,
            comment: updated.comment,
            createdAt: updated.createdAt.toISOString(),
            postedToYouTube: false,
        });
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Update comment error');
        res.status(500).json({ message: 'Failed to update comment' });
    }
};
exports.updateVideoComment = updateVideoComment;
const deleteVideoComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const comment = await prisma.videoComment.findUnique({
            where: { id: commentId },
        });
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }
        // Admins can delete ANY comment — moderation. authenticateToken
        // already populates req.user.role, so this check doesn't need
        // resolveSubject at all (an admin is never "acting as a child").
        if (req.user?.role === 'ADMIN') {
            await prisma.videoComment.delete({ where: { id: commentId } });
            logger_1.default.info(`✅ Comment deleted by ADMIN: ${commentId}`);
            return res.json({ success: true, message: 'Comment deleted successfully' });
        }
        // Everyone else can only delete their own — must resolve to the SAME
        // account postVideoComment would have used, or a child's own comment
        // (correctly attributed to their linked account) would become
        // undeletable by them during a mentor's PIN session.
        const userId = (0, resolveSubject_1.resolveOwnerUserId)(req, res);
        if (!userId)
            return;
        if (comment.userId !== userId) {
            return res.status(403).json({ message: 'Not authorized to delete this comment' });
        }
        await prisma.videoComment.delete({
            where: { id: commentId },
        });
        logger_1.default.info(`✅ Comment deleted: ${commentId}`);
        res.json({ success: true, message: 'Comment deleted successfully' });
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Delete comment error');
        res.status(500).json({ message: 'Failed to delete comment' });
    }
};
exports.deleteVideoComment = deleteVideoComment;
// ========================================================================
// ADMIN COMMENT MODERATION
// ========================================================================
const listCommentsForModeration = async (req, res) => {
    try {
        const limit = Math.min(200, parseInt(req.query.limit) || 100);
        const videoId = req.query.videoId;
        const comments = await prisma.videoComment.findMany({
            where: videoId ? { videoId } : undefined,
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        res.json({
            success: true,
            comments: comments.map((c) => ({
                id: c.id,
                videoId: c.videoId,
                userId: c.userId,
                userName: c.user.name,
                comment: c.comment,
                createdAt: c.createdAt.toISOString(),
                postedToYouTube: c.postedToYouTube,
                youtubeCommentId: c.youtubeCommentId,
            })),
        });
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ List comments (admin) error');
        res.status(500).json({ message: 'Failed to list comments' });
    }
};
exports.listCommentsForModeration = listCommentsForModeration;
const postCommentToYouTube = async (req, res) => {
    try {
        const { commentId } = req.params;
        const comment = await prisma.videoComment.findUnique({
            where: { id: commentId },
            include: { user: { select: { name: true } } },
        });
        if (!comment)
            return res.status(404).json({ message: 'Comment not found' });
        if (comment.postedToYouTube) {
            return res.status(400).json({ message: 'Already posted to YouTube' });
        }
        // Reuses the same authenticated youtubeAuth client already set up at
        // module scope above (module-level OAuth2 client, not re-created here).
        const response = await youtubeAuth.commentThreads.insert({
            part: ['snippet'],
            requestBody: {
                snippet: {
                    videoId: comment.videoId,
                    topLevelComment: {
                        snippet: {
                            textOriginal: `${comment.comment}\n\n- ${comment.user.name} (via MiniGuru App)`,
                        },
                    },
                },
            },
        });
        const youtubeCommentId = response.data.id || null;
        await prisma.videoComment.update({
            where: { id: commentId },
            data: { postedToYouTube: true, youtubeCommentId },
        });
        logger_1.default.info(`✅ Comment manually pushed to YouTube by admin: ${youtubeCommentId}`);
        res.json({ success: true, youtubeCommentId });
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Post comment to YouTube (admin) error');
        res.status(500).json({
            message: 'Failed to post comment to YouTube. The video may not be public yet on YouTube, or the YouTube credentials may need renewal.',
        });
    }
};
exports.postCommentToYouTube = postCommentToYouTube;
