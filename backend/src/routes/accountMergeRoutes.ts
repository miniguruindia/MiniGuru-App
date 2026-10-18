// backend/src/routes/accountMergeRoutes.ts
// Admin-only: merge two accounts of the SAME child (Oct 2026). Mounted at /admin.
//   GET  /admin/merge-accounts/search?q=      find child accounts by name / login ID
//   GET  /admin/merge-accounts/preview?keepId=&dropId=   what would move (changes nothing)
//   POST /admin/merge-accounts  { keepId, dropId, excludeStarterGoins, confirm: "MERGE" }
// Everything owned by the "drop" account is moved to the "keep" account: Goins
// (added up), projects (+ collaborator name), views, likes, comments, ratings,
// notifications, orders, quest progress, Goins ledger, uploads, school link.
// The dropped account is CLOSED (login disabled, renamed), not deleted, and an
// AccountMergeLog row is written. Safe to re-run if it stops half-way: the
// dropped account is closed only at the very end.
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../utils/prismaClient';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticateToken, authorizeAdmin);

const STARTER_GOINS = 100;
const db: any = prisma;

async function loadPair(keepId: string, dropId: string) {
  if (!keepId || !dropId) return { error: 'Choose both accounts.' };
  if (keepId === dropId) return { error: 'Choose two different accounts.' };
  const sel = { id: true, name: true, email: true, age: true, role: true, isMentor: true, score: true, currentStreak: true, lastQuestDate: true, guardianEmail: true, phoneNumber: true };
  const [keep, drop] = await Promise.all([
    prisma.user.findUnique({ where: { id: keepId }, select: sel }),
    prisma.user.findUnique({ where: { id: dropId }, select: sel }),
  ]);
  if (!keep || !drop) return { error: 'Account not found.' };
  for (const u of [keep, drop] as any[]) {
    if (u.role !== 'USER' || u.isMentor) return { error: `${u.name} is not a child/learner account. Only learner accounts can be merged.` };
  }
  if (String((drop as any).email).startsWith('merged-')) return { error: 'The account to close was already merged.' };
  return { keep: keep as any, drop: drop as any };
}

async function countsFor(dropId: string) {
  const [projects, collabs, views, vlikes, vcomments, notifications, comments, likes, orders, ratingsGiven, ratingsGot, events, quests, topups, uploads, schoolLinks, joins] = await Promise.all([
    db.project.count({ where: { userId: dropId } }),
    db.project.count({ where: { collaborators: { some: { userId: dropId } } } }),
    db.videoView.count({ where: { userId: dropId } }),
    db.videoLike.count({ where: { userId: dropId } }),
    db.videoComment.count({ where: { userId: dropId } }),
    db.notification.count({ where: { userId: dropId } }),
    db.comment.count({ where: { commentedById: dropId } }),
    db.like.count({ where: { likedById: dropId } }),
    db.order.count({ where: { userId: dropId } }),
    db.videoRating.count({ where: { raterId: dropId } }),
    db.videoRating.count({ where: { creatorId: dropId } }),
    db.goinsEvent.count({ where: { userId: dropId } }),
    db.dailyQuestProgress.count({ where: { userId: dropId } }),
    db.goinTopUpRequest.count({ where: { requesterId: dropId } }),
    db.pendingVideo.count({ where: { uploadedById: dropId } }),
    db.childProfile.count({ where: { linkedUserId: dropId, isActive: true } }),
    db.schoolJoinRequest.count({ where: { childUserId: dropId, status: 'PENDING' } }),
  ]);
  return {
    projects, collaborations: collabs, videoViews: views, videoLikes: vlikes, videoComments: vcomments,
    notifications, projectComments: comments, projectLikes: likes, orders,
    ratingsGiven, ratingsReceived: ratingsGot, goinsLedgerRows: events, dailyQuestDays: quests,
    goinsRequests: topups, videoUploads: uploads, activeSchoolLinks: schoolLinks, pendingJoinRequests: joins,
  };
}

// GET /admin/merge-accounts/search?q=
router.get('/merge-accounts/search', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });
    const users = await prisma.user.findMany({
      where: {
        role: 'USER', isMentor: false,
        NOT: { email: { startsWith: 'merged-' } },
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }],
      },
      select: { id: true, name: true, email: true, age: true, score: true, createdAt: true },
      orderBy: { name: 'asc' },
      take: 15,
    });
    const out: any[] = [];
    for (const u of users) {
      const [projects, link] = await Promise.all([
        db.project.count({ where: { userId: u.id } }),
        db.childProfile.findFirst({ where: { linkedUserId: u.id, isActive: true }, select: { guardianId: true } }),
      ]);
      let school: string | null = null;
      if (link) {
        const g = await prisma.user.findUnique({ where: { id: link.guardianId }, select: { name: true, guardianInfo: true } });
        school = (g && ((g as any).guardianInfo?.institutionName || g.name)) || null;
      }
      out.push({ ...u, projects, school });
    }
    return res.json({ users: out });
  } catch (e: any) {
    console.error('merge search error:', e);
    return res.status(500).json({ message: 'Search failed' });
  }
});

// GET /admin/merge-accounts/preview?keepId=&dropId=
router.get('/merge-accounts/preview', async (req: Request, res: Response) => {
  try {
    const r: any = await loadPair(String(req.query.keepId || ''), String(req.query.dropId || ''));
    if (r.error) return res.status(400).json({ message: r.error });
    const counts = await countsFor(r.drop.id);
    const starter = Math.min(STARTER_GOINS, Math.max(0, r.drop.score));
    return res.json({
      keep: { id: r.keep.id, name: r.keep.name, email: r.keep.email, score: r.keep.score },
      drop: { id: r.drop.id, name: r.drop.name, email: r.drop.email, score: r.drop.score },
      counts,
      goins: {
        keepNow: r.keep.score,
        dropNow: r.drop.score,
        starterBonusOfClosed: starter,
        totalIfAll: r.keep.score + r.drop.score,
        totalWithoutStarter: r.keep.score + r.drop.score - starter,
      },
    });
  } catch (e: any) {
    console.error('merge preview error:', e);
    return res.status(500).json({ message: 'Preview failed' });
  }
});

// POST /admin/merge-accounts
router.post('/merge-accounts', async (req: Request, res: Response) => {
  try {
    const { keepId, dropId, excludeStarterGoins, confirm } = req.body || {};
    if (confirm !== 'MERGE') return res.status(400).json({ message: 'Type MERGE to confirm.' });
    const r: any = await loadPair(String(keepId || ''), String(dropId || ''));
    if (r.error) return res.status(400).json({ message: r.error });
    const { keep, drop } = r;
    const before = await countsFor(drop.id);
    const keepId2 = keep.id as string;
    const dropId2 = drop.id as string;

    // 1) simple re-pointing, with duplicate-safe handling where a unique rule exists
    const keepLikes = await db.videoLike.findMany({ where: { userId: keepId2 }, select: { videoId: true, category: true } });
    const likeKeys = new Set(keepLikes.map((l: any) => `${l.videoId}|${l.category}`));
    const dropLikes = await db.videoLike.findMany({ where: { userId: dropId2 }, select: { id: true, videoId: true, category: true } });
    const dupLikeIds = dropLikes.filter((l: any) => likeKeys.has(`${l.videoId}|${l.category}`)).map((l: any) => l.id);
    if (dupLikeIds.length) await db.videoLike.deleteMany({ where: { id: { in: dupLikeIds } } });
    await db.videoLike.updateMany({ where: { userId: dropId2 }, data: { userId: keepId2 } });

    const keepPLikes = await db.like.findMany({ where: { likedById: keepId2 }, select: { projectId: true } });
    const pLikeKeys = new Set(keepPLikes.map((l: any) => l.projectId));
    const dropPLikes = await db.like.findMany({ where: { likedById: dropId2 }, select: { id: true, projectId: true } });
    const dupPLike = dropPLikes.filter((l: any) => pLikeKeys.has(l.projectId)).map((l: any) => l.id);
    if (dupPLike.length) await db.like.deleteMany({ where: { id: { in: dupPLike } } });
    await db.like.updateMany({ where: { likedById: dropId2 }, data: { likedById: keepId2 } });

    const keepRatings = await db.videoRating.findMany({ where: { raterId: keepId2 }, select: { videoId: true } });
    const ratedKeys = new Set(keepRatings.map((x: any) => x.videoId));
    const dropRatings = await db.videoRating.findMany({ where: { raterId: dropId2 }, select: { id: true, videoId: true } });
    const dupRatings = dropRatings.filter((x: any) => ratedKeys.has(x.videoId)).map((x: any) => x.id);
    if (dupRatings.length) await db.videoRating.deleteMany({ where: { id: { in: dupRatings } } });
    await db.videoRating.updateMany({ where: { raterId: dropId2 }, data: { raterId: keepId2 } });
    await db.videoRating.updateMany({ where: { creatorId: dropId2 }, data: { creatorId: keepId2 } });

    const keepQuest = await db.dailyQuestProgress.findMany({ where: { userId: keepId2 }, select: { date: true } });
    const questDates = new Set(keepQuest.map((x: any) => x.date));
    const dropQuest = await db.dailyQuestProgress.findMany({ where: { userId: dropId2 }, select: { id: true, date: true } });
    const dupQuest = dropQuest.filter((x: any) => questDates.has(x.date)).map((x: any) => x.id);
    if (dupQuest.length) await db.dailyQuestProgress.deleteMany({ where: { id: { in: dupQuest } } });
    await db.dailyQuestProgress.updateMany({ where: { userId: dropId2 }, data: { userId: keepId2 } });

    await db.videoView.updateMany({ where: { userId: dropId2 }, data: { userId: keepId2 } });
    await db.videoComment.updateMany({ where: { userId: dropId2 }, data: { userId: keepId2 } });
    await db.notification.updateMany({ where: { userId: dropId2 }, data: { userId: keepId2 } });
    await db.comment.updateMany({ where: { commentedById: dropId2 }, data: { commentedById: keepId2 } });
    await db.order.updateMany({ where: { userId: dropId2 }, data: { userId: keepId2 } });
    await db.productSuggestion.updateMany({ where: { userId: dropId2 }, data: { userId: keepId2 } });
    await db.goinsEvent.updateMany({ where: { userId: dropId2 }, data: { userId: keepId2 } });
    await db.pendingVideo.updateMany({ where: { uploadedById: dropId2 }, data: { uploadedById: keepId2 } });
    await db.goinTopUpRequest.updateMany({ where: { requesterId: dropId2 }, data: { requesterId: keepId2, requesterName: keep.name } });
    await db.happening.updateMany({ where: { submittedById: dropId2 }, data: { submittedById: keepId2, submittedByName: keep.name } });
    await db.challenge.updateMany({ where: { submittedById: dropId2 }, data: { submittedById: keepId2, submittedByName: keep.name } });

    // 2) projects: owner, and the collaborator name snapshot
    await db.project.updateMany({ where: { userId: dropId2 }, data: { userId: keepId2 } });
    const collabProjects = await db.project.findMany({
      where: { collaborators: { some: { userId: dropId2 } } },
      select: { id: true, userId: true, collaborators: true },
    });
    for (const p of collabProjects) {
      const seen = new Set<string>();
      const list: { userId: string; name: string }[] = [];
      for (const c of p.collaborators as any[]) {
        const uid = String(c.userId) === dropId2 ? keepId2 : String(c.userId);
        const name = uid === keepId2 ? keep.name : c.name;
        if (uid === String(p.userId) || seen.has(uid)) continue; // owner is never also a collaborator
        seen.add(uid);
        list.push({ userId: uid, name });
      }
      await db.project.update({ where: { id: p.id }, data: { collaborators: { set: list } } });
    }
    // other collaborators' snapshots of the kept child's name stay in step too
    const keepCollab = await db.project.findMany({ where: { collaborators: { some: { userId: keepId2 } } }, select: { id: true, collaborators: true } });
    for (const p of keepCollab) {
      const list = (p.collaborators as any[]).map((c) => (String(c.userId) === keepId2 ? { userId: keepId2, name: keep.name } : { userId: String(c.userId), name: c.name }));
      await db.project.update({ where: { id: p.id }, data: { collaborators: { set: list } } });
    }

    // 3) wallet (one per user)
    const [kw, dw] = await Promise.all([db.wallet.findUnique({ where: { userId: keepId2 } }), db.wallet.findUnique({ where: { userId: dropId2 } })]);
    if (dw && !kw) {
      await db.wallet.update({ where: { id: dw.id }, data: { userId: keepId2 } });
    } else if (dw && kw) {
      await db.transaction.updateMany({ where: { walletId: dw.id }, data: { walletId: kw.id } });
      await db.wallet.update({ where: { id: kw.id }, data: { balance: (kw.balance || 0) + (dw.balance || 0) } });
      await db.wallet.delete({ where: { id: dw.id } });
    }

    // 4) school / family links: the moved link stays active only if the kept child has no other active one
    const keepActive = await db.childProfile.findFirst({ where: { linkedUserId: keepId2, isActive: true }, select: { id: true } });
    const dropLinks = await db.childProfile.findMany({ where: { linkedUserId: dropId2 }, select: { id: true, isActive: true, guardianId: true } });
    let activeTaken = !!keepActive;
    for (const l of dropLinks) {
      const keepSame = await db.childProfile.findFirst({ where: { linkedUserId: keepId2, guardianId: l.guardianId }, select: { id: true } });
      if (keepSame || (l.isActive && activeTaken)) {
        await db.childProfile.update({ where: { id: l.id }, data: { isActive: false, linkedUserId: null } });
      } else {
        await db.childProfile.update({ where: { id: l.id }, data: { linkedUserId: keepId2 } });
        if (l.isActive) activeTaken = true;
      }
    }
    await db.schoolJoinRequest.updateMany({ where: { childUserId: dropId2, status: 'PENDING' }, data: { status: 'CANCELLED', decidedAt: new Date() } });

    // 5) Goins, streak, contact
    const starter = excludeStarterGoins ? Math.min(STARTER_GOINS, Math.max(0, drop.score)) : 0;
    const newScore = keep.score + drop.score - starter;
    const lastQuest = [keep.lastQuestDate, drop.lastQuestDate].filter(Boolean).sort().pop() || null;
    await db.user.update({
      where: { id: keepId2 },
      data: {
        score: newScore,
        currentStreak: Math.max(keep.currentStreak || 0, drop.currentStreak || 0),
        lastQuestDate: lastQuest,
        ...(!keep.guardianEmail && drop.guardianEmail ? { guardianEmail: drop.guardianEmail } : {}),
        scoreHistory: { push: { time: new Date(), updatedScore: newScore, reason: `Accounts merged: added ${drop.score - starter} Goins from ${drop.name}` } },
      },
    });

    // 6) close (not delete) the dropped account
    await db.user.update({
      where: { id: dropId2 },
      data: {
        email: `merged-${dropId2}@closed.miniguru.invalid`,
        name: `${drop.name} (merged)`,
        passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
        refreshToken: null,
        score: 0,
        guardianEmail: null,
        emailVerified: false,
      },
    });

    await db.accountMergeLog.create({
      data: {
        keepUserId: keepId2, droppedUserId: dropId2,
        droppedName: drop.name, droppedEmail: drop.email, keptName: keep.name,
        summary: { moved: before, goinsBefore: { keep: keep.score, drop: drop.score }, goinsAfter: newScore, starterExcluded: starter },
        doneBy: (req as any).user?.id ?? null,
      },
    });
    return res.json({ message: 'Accounts merged', keptName: keep.name, goinsAfter: newScore, moved: before });
  } catch (e: any) {
    console.error('merge accounts error:', e);
    return res.status(500).json({ message: 'The merge stopped part-way (' + (e?.message || 'error') + '). Nothing is lost: run it again and it continues where it stopped.' });
  }
});

export default router;
