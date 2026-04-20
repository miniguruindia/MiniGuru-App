"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// ─── Criteria list — matches Flutter UI and Prisma booleans exactly ──────────
const CRITERIA = ['sturdy', 'creative', 'functional', 'resourceful', 'documented'];
// ─── Goins per criterion ─────────────────────────────────────────────────────
const GOINS_PER_CRITERION = 10;
// ════════════════════════════════════════════════════════════════════════════
// POST /api/videos/:id/rate
// Submit a 5-criteria rating for a video.
// Body: { sturdy, creative, functional, resourceful, documented } — all boolean
//
// Rules:
// - One rating per video per user (@@unique enforced in DB too)
// - Cannot rate your own video
// - Goins awarded = count(true criteria) × 10 × (isCrossSchool ? 2 : 1)
// - Goins added to creator's user.score immediately
// - If rating already exists, UPDATE it (adjust Goins delta)
// ════════════════════════════════════════════════════════════════════════════
router.post('/:id/rate', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const raterId = req.user?.userId;
        const videoId = req.params.id;
        // ── Validate criteria in body ───────────────────────────────────────────
        const criteria = {
            sturdy: Boolean(req.body.sturdy),
            creative: Boolean(req.body.creative),
            functional: Boolean(req.body.functional),
            resourceful: Boolean(req.body.resourceful),
            documented: Boolean(req.body.documented),
        };
        const selectedCount = CRITERIA.filter(c => criteria[c]).length;
        if (selectedCount === 0) {
            return res.status(400).json({ error: 'Select at least one criterion to rate.' });
        }
        // ── Find the project/video to get creatorId ─────────────────────────────
        // videoId in the community feed is the project id
        const project = await prismaClient_1.default.pendingVideo.findUnique({
            where: { id: videoId },
            select: { uploadedById: true },
        });
        if (!project) {
            return res.status(404).json({ error: 'Video not found.' });
        }
        const creatorId = project.uploadedById;
        if (creatorId === raterId) {
            return res.status(403).json({ error: 'You cannot rate your own video.' });
        }
        // ── Determine cross-school ──────────────────────────────────────────────
        // Compare mentorId (school affiliation) of rater vs creator
        const [rater, creator] = await Promise.all([
            prismaClient_1.default.user.findUnique({ where: { id: raterId }, select: { guardianInfo: true, mentorType: true } }),
            prismaClient_1.default.user.findUnique({ where: { id: creatorId }, select: { guardianInfo: true, mentorType: true } }),
        ]);
        // isCrossSchool = true if rater and creator have different guardian/school
        // For individual users (no guardian), always cross-school = true
        const raterGuardian = rater?.guardianInfo?.guardianId || null;
        const creatorGuardian = creator?.guardianInfo?.guardianId || null;
        const isCrossSchool = !raterGuardian || !creatorGuardian || raterGuardian !== creatorGuardian;
        const multiplier = isCrossSchool ? 2 : 1;
        const goinsAwarded = selectedCount * GOINS_PER_CRITERION * multiplier;
        // ── Check for existing rating ───────────────────────────────────────────
        const existing = await prismaClient_1.default.videoRating.findUnique({
            where: { videoId_raterId: { videoId, raterId } },
        });
        if (existing) {
            // UPDATE: adjust Goins delta
            const goinsDelta = goinsAwarded - existing.goinsAwarded;
            await prismaClient_1.default.$transaction([
                // Update the rating record
                prismaClient_1.default.videoRating.update({
                    where: { videoId_raterId: { videoId, raterId } },
                    data: { ...criteria, isCrossSchool, goinsAwarded },
                }),
                // Adjust creator score by delta (can be positive or negative)
                prismaClient_1.default.user.update({
                    where: { id: creatorId },
                    data: { score: { increment: goinsDelta } },
                }),
            ]);
            return res.json({
                success: true,
                action: 'updated',
                goinsAwarded,
                goinsDelta,
                isCrossSchool,
                multiplier,
            });
        }
        // ── Create new rating ───────────────────────────────────────────────────
        await prismaClient_1.default.$transaction([
            prismaClient_1.default.videoRating.create({
                data: {
                    videoId,
                    raterId,
                    creatorId,
                    ...criteria,
                    isCrossSchool,
                    goinsAwarded,
                },
            }),
            prismaClient_1.default.user.update({
                where: { id: creatorId },
                data: { score: { increment: goinsAwarded } },
            }),
            // +1 Goin to rater for peer assessment
            prismaClient_1.default.user.update({
                where: { id: raterId },
                data: { score: { increment: 1 } },
            }),
        ]);
        res.status(201).json({
            success: true,
            action: 'created',
            goinsAwarded,
            isCrossSchool,
            multiplier,
            breakdown: {
                criteria: selectedCount,
                goinsPerCriterion: GOINS_PER_CRITERION,
                multiplier,
                total: goinsAwarded,
            },
        });
    }
    catch (err) {
        console.error('[videoRating] POST /:id/rate error:', err);
        res.status(500).json({ error: 'Failed to submit rating.' });
    }
});
// ════════════════════════════════════════════════════════════════════════════
// GET /api/videos/:id/ratings
// Returns:
// - breakdown: count of raters who selected each criterion
// - totalRaters: how many people rated this video
// - myRating: the current user's rating (null if not rated)
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/ratings', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const raterId = req.user?.userId;
        const videoId = req.params.id;
        const ratings = await prismaClient_1.default.videoRating.findMany({
            where: { videoId },
        });
        // Aggregate breakdown — how many people selected each criterion
        const breakdown = {
            sturdy: 0,
            creative: 0,
            functional: 0,
            resourceful: 0,
            documented: 0,
        };
        for (const r of ratings) {
            for (const c of CRITERIA) {
                if (r[c])
                    breakdown[c]++;
            }
        }
        // Current user's own rating
        const myRating = ratings.find(r => r.raterId === raterId) || null;
        res.json({
            videoId,
            totalRaters: ratings.length,
            breakdown,
            myRating: myRating ? {
                sturdy: myRating.sturdy,
                creative: myRating.creative,
                functional: myRating.functional,
                resourceful: myRating.resourceful,
                documented: myRating.documented,
                goinsAwarded: myRating.goinsAwarded,
                isCrossSchool: myRating.isCrossSchool,
            } : null,
        });
    }
    catch (err) {
        console.error('[videoRating] GET /:id/ratings error:', err);
        res.status(500).json({ error: 'Failed to fetch ratings.' });
    }
});
exports.default = router;
