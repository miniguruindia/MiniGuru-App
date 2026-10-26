"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/adminDeleteUserRoutes.ts
// Admin-only "safe delete" for any account (Oct 2026). Mounted at /admin.
//   GET  /admin/users/:userId/delete-preview   what would happen (changes nothing)
//   POST /admin/users/:userId/delete           { mode: 'keep' | 'remove', confirm: 'DELETE' }
//
// Rules:
//  * A school / T-LAB / parent that is deleted NEVER takes its students with it.
//    Each student keeps their own login, Goins and projects and simply becomes an
//    independent learner (their school/family link row is removed).
//  * mode 'keep'   : projects, comments, ratings, views, Goins record, etc. are
//                    first moved to the MiniGuru account (miniguru@miniguru.in),
//                    then the person is deleted. YouTube videos are never touched.
//  * mode 'remove' : the old behaviour (everything of theirs goes), but students
//                    still stay.
// Safe to run again if it stops half-way: every step is a move or a delete of
// rows that are still there, and the account itself is deleted last.
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin);
const db = prismaClient_1.default;
const KEEP_ACCOUNT_EMAIL = 'miniguru@miniguru.in';
const OID = /^[a-f0-9]{24}$/i;
async function loadUser(userId) {
    if (!OID.test(userId))
        return { error: 'Not a valid account id.', status: 400 };
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user)
        return { error: 'Account not found (it may already be deleted).', status: 404 };
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        return { error: 'Admin accounts cannot be deleted here.', status: 400 };
    }
    return { user };
}
async function findKeepAccount() {
    return db.user.findFirst({
        where: { email: { equals: KEEP_ACCOUNT_EMAIL, mode: 'insensitive' } },
        select: { id: true, name: true, email: true, score: true },
    });
}
// GET /admin/users/:userId/delete-preview
router.get('/users/:userId/delete-preview', async (req, res) => {
    try {
        const r = await loadUser(req.params.userId);
        if (r.error)
            return res.status(r.status).json({ message: r.error });
        const user = r.user;
        const id = user.id;
        const [linked, legacy, inList, projects, comments, videoComments, ratingsReceived, goinsRows, waiting, keepAcc] = await Promise.all([
            db.childProfile.findMany({ where: { guardianId: id, isActive: true, linkedUserId: { not: null } }, select: { name: true } }),
            db.childProfile.count({ where: { guardianId: id, isActive: true, linkedUserId: null } }),
            db.childProfile.count({ where: { linkedUserId: id, isActive: true } }),
            db.project.count({ where: { userId: id } }),
            db.comment.count({ where: { commentedById: id } }),
            db.videoComment.count({ where: { userId: id } }),
            db.videoRating.count({ where: { creatorId: id } }),
            db.goinsEvent.count({ where: { userId: id } }),
            db.schoolJoinRequest.count({ where: { schoolId: id, status: 'PENDING' } }),
            findKeepAccount(),
        ]);
        return res.json({
            user: { id, name: user.name, email: user.email, score: user.score ?? 0, isMentor: !!user.isMentor, mentorType: user.mentorType ?? null },
            students: { count: linked.length, names: linked.slice(0, 12).map((c) => c.name), withoutLogin: legacy },
            inSomeonesList: inList,
            content: { projects, projectComments: comments, videoComments, ratingsOnTheirVideos: ratingsReceived, goinsRecords: goinsRows, waitingJoinRequests: waiting },
            keepAccount: keepAcc ? { name: keepAcc.name, email: keepAcc.email } : null,
        });
    }
    catch (e) {
        console.error('delete-preview error:', e);
        return res.status(500).json({ message: 'Preview failed' });
    }
});
// Move rows that have a unique rule: drop the ones the target already has, move the rest.
async function moveWithoutDuplicates(model, ownerField, keyOf, fromId, toId) {
    const mine = await db[model].findMany({ where: { [ownerField]: toId } });
    const have = new Set(mine.map(keyOf));
    const theirs = await db[model].findMany({ where: { [ownerField]: fromId } });
    const dupIds = theirs.filter((row) => have.has(keyOf(row))).map((row) => row.id);
    if (dupIds.length)
        await db[model].deleteMany({ where: { id: { in: dupIds } } });
    await db[model].updateMany({ where: { [ownerField]: fromId }, data: { [ownerField]: toId } });
}
// POST /admin/users/:userId/delete
router.post('/users/:userId/delete', async (req, res) => {
    try {
        const { mode, confirm } = req.body || {};
        if (confirm !== 'DELETE')
            return res.status(400).json({ message: 'Type DELETE to confirm.' });
        if (mode !== 'keep' && mode !== 'remove')
            return res.status(400).json({ message: 'Choose "keep content" or "remove everything".' });
        const r = await loadUser(req.params.userId);
        if (r.error)
            return res.status(r.status).json({ message: r.error });
        const user = r.user;
        const fromId = user.id;
        const me = req.user?.userId || req.user?.id;
        if (me && String(me) === fromId)
            return res.status(400).json({ message: 'You cannot delete your own account here.' });
        const studentsBefore = await db.childProfile.count({ where: { guardianId: fromId, isActive: true, linkedUserId: { not: null } } });
        const moved = {};
        if (mode === 'keep') {
            const keepAcc = await findKeepAccount();
            if (!keepAcc)
                return res.status(400).json({ message: `The MiniGuru account (${KEEP_ACCOUNT_EMAIL}) was not found, so content cannot be kept. Nothing was deleted.` });
            if (keepAcc.id === fromId)
                return res.status(400).json({ message: 'This is the MiniGuru account itself.' });
            const toId = keepAcc.id;
            // projects (and the name shown for them), then people listed as collaborators
            moved.projects = (await db.project.updateMany({ where: { userId: fromId }, data: { userId: toId } })).count;
            const collabProjects = await db.project.findMany({
                where: { collaborators: { some: { userId: fromId } } },
                select: { id: true, userId: true, collaborators: true },
            });
            for (const p of collabProjects) {
                const seen = new Set();
                const list = [];
                for (const c of p.collaborators) {
                    const uid = String(c.userId) === fromId ? toId : String(c.userId);
                    const name = uid === toId ? keepAcc.name : c.name;
                    if (uid === String(p.userId) || seen.has(uid))
                        continue;
                    seen.add(uid);
                    list.push({ userId: uid, name });
                }
                await db.project.update({ where: { id: p.id }, data: { collaborators: { set: list } } });
            }
            moved.projectComments = (await db.comment.updateMany({ where: { commentedById: fromId }, data: { commentedById: toId } })).count;
            moved.videoComments = (await db.videoComment.updateMany({ where: { userId: fromId }, data: { userId: toId } })).count;
            moved.videoViews = (await db.videoView.updateMany({ where: { userId: fromId }, data: { userId: toId } })).count;
            await moveWithoutDuplicates('videoLike', 'userId', (x) => `${x.videoId}|${x.category}`, fromId, toId);
            await moveWithoutDuplicates('like', 'likedById', (x) => String(x.projectId), fromId, toId);
            await moveWithoutDuplicates('videoRating', 'raterId', (x) => String(x.videoId), fromId, toId);
            moved.ratingsOnTheirVideos = (await db.videoRating.updateMany({ where: { creatorId: fromId }, data: { creatorId: toId } })).count;
            moved.goinsRecords = (await db.goinsEvent.updateMany({ where: { userId: fromId }, data: { userId: toId } })).count;
            await db.pendingVideo.updateMany({ where: { uploadedById: fromId }, data: { uploadedById: toId } });
            await db.productSuggestion.updateMany({ where: { userId: fromId }, data: { userId: toId } });
            await db.goinTopUpRequest.updateMany({ where: { requesterId: fromId }, data: { requesterId: toId, requesterName: keepAcc.name } });
            await db.happening.updateMany({ where: { submittedById: fromId }, data: { submittedById: toId, submittedByName: keepAcc.name } });
            await db.challenge.updateMany({ where: { submittedById: fromId }, data: { submittedById: toId, submittedByName: keepAcc.name } });
            await db.order.updateMany({ where: { userId: fromId }, data: { userId: toId } });
            // their Goins total goes to the MiniGuru account too
            const goins = Math.max(0, user.score || 0);
            if (goins > 0) {
                const newScore = (keepAcc.score || 0) + goins;
                await db.user.update({
                    where: { id: toId },
                    data: { score: newScore, scoreHistory: { push: { time: new Date(), updatedScore: newScore, reason: `Kept Goins of deleted account ${user.name}` } } },
                });
                moved.goins = goins;
            }
        }
        else {
            // remove everything of theirs that does not go away by itself
            await db.goinsEvent.deleteMany({ where: { userId: fromId } });
        }
        // things that belong only to this person and are never kept
        await db.notification.deleteMany({ where: { userId: fromId } });
        await db.savedItem.deleteMany({ where: { userId: fromId } });
        await db.dailyQuestProgress.deleteMany({ where: { userId: fromId } });
        // students stay: only the school/family link rows go (they become independent learners)
        await db.schoolJoinRequest.updateMany({ where: { OR: [{ schoolId: fromId }, { childUserId: fromId }], status: 'PENDING' }, data: { status: 'CANCELLED', decidedAt: new Date() } });
        await db.childProfile.deleteMany({ where: { linkedUserId: fromId } }); // this person's own place in a school/family list
        // last step: the account (its list of students' link rows goes with it; the students themselves stay)
        await prismaClient_1.default.user.delete({ where: { id: fromId } });
        console.log(`[admin] deleted ${user.email} (${mode}) by ${me}; students kept: ${studentsBefore}`);
        return res.json({ message: 'Account deleted', mode, studentsKept: studentsBefore, moved });
    }
    catch (e) {
        console.error('delete user error:', e);
        return res.status(500).json({ message: 'The delete stopped part-way (' + (e?.message || 'error') + '). Nothing is lost: run it again and it continues where it stopped.' });
    }
});
exports.default = router;
