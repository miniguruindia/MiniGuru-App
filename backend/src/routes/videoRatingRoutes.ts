import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// ─── Criteria list — matches Flutter UI and Prisma booleans exactly ──────────
const CRITERIA = ['sturdy', 'creative', 'functional', 'resourceful', 'documented'] as const;
type Criterion = typeof CRITERIA[number];

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
router.post('/:id/rate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const raterId = (req as any).user?.userId;
    const videoId = req.params.id;

    // ── Validate criteria in body ───────────────────────────────────────────
    const criteria: Record<Criterion, boolean> = {
      sturdy:      Boolean(req.body.sturdy),
      creative:    Boolean(req.body.creative),
      functional:  Boolean(req.body.functional),
      resourceful: Boolean(req.body.resourceful),
      documented:  Boolean(req.body.documented),
    };

    const selectedCount = CRITERIA.filter(c => criteria[c]).length;
    if (selectedCount === 0) {
      return res.status(400).json({ error: 'Select at least one criterion to rate.' });
    }

    // ── Find the project/video to get creatorId ─────────────────────────────
    // videoId in the community feed is the project id
    const project = await prisma.project.findUnique({
      where: { id: videoId },
      select: { userId: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    const creatorId = project.userId;

    if (creatorId === raterId) {
      return res.status(403).json({ error: 'You cannot rate your own video.' });
    }

    // ── Determine cross-school ──────────────────────────────────────────────
    // Compare mentorId (school affiliation) of rater vs creator
    const [rater, creator] = await Promise.all([
      prisma.user.findUnique({ where: { id: raterId }, select: { guardianInfo: true, mentorType: true } }),
      prisma.user.findUnique({ where: { id: creatorId }, select: { guardianInfo: true, mentorType: true } }),
    ]);

    // isCrossSchool = true if rater and creator have different guardian/school
    // For individual users (no guardian), always cross-school = true
    const raterGuardian = (rater?.guardianInfo as any)?.guardianId || null;
    const creatorGuardian = (creator?.guardianInfo as any)?.guardianId || null;
    const isCrossSchool = !raterGuardian || !creatorGuardian || raterGuardian !== creatorGuardian;

    const multiplier = isCrossSchool ? 2 : 1;
    const goinsAwarded = selectedCount * GOINS_PER_CRITERION * multiplier;

    // ── Check for existing rating ───────────────────────────────────────────
    const existing = await prisma.videoRating.findUnique({
      where: { videoId_raterId: { videoId, raterId } },
    });

    if (existing) {
      // UPDATE: adjust Goins delta
      const goinsDelta = goinsAwarded - existing.goinsAwarded;

      await prisma.$transaction([
        // Update the rating record
        prisma.videoRating.update({
          where: { videoId_raterId: { videoId, raterId } },
          data: { ...criteria, isCrossSchool, goinsAwarded },
        }),
        // Adjust creator score by delta (can be positive or negative)
        prisma.user.update({
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
    await prisma.$transaction([
      prisma.videoRating.create({
        data: {
          videoId,
          raterId,
          creatorId,
          ...criteria,
          isCrossSchool,
          goinsAwarded,
        },
      }),
      // Award Goins to creator
      prisma.user.update({
        where: { id: creatorId },
        data: { score: { increment: goinsAwarded } },
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
  } catch (err: any) {
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
router.get('/:id/ratings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const raterId = (req as any).user?.userId;
    const videoId = req.params.id;

    const ratings = await prisma.videoRating.findMany({
      where: { videoId },
    });

    // Aggregate breakdown — how many people selected each criterion
    const breakdown: Record<Criterion, number> = {
      sturdy:      0,
      creative:    0,
      functional:  0,
      resourceful: 0,
      documented:  0,
    };
    for (const r of ratings) {
      for (const c of CRITERIA) {
        if ((r as any)[c]) breakdown[c]++;
      }
    }

    // Current user's own rating
    const myRating = ratings.find(r => r.raterId === raterId) || null;

    res.json({
      videoId,
      totalRaters: ratings.length,
      breakdown,
      myRating: myRating ? {
        sturdy:      myRating.sturdy,
        creative:    myRating.creative,
        functional:  myRating.functional,
        resourceful: myRating.resourceful,
        documented:  myRating.documented,
        goinsAwarded: myRating.goinsAwarded,
        isCrossSchool: myRating.isCrossSchool,
      } : null,
    });
  } catch (err) {
    console.error('[videoRating] GET /:id/ratings error:', err);
    res.status(500).json({ error: 'Failed to fetch ratings.' });
  }
});

export default router;