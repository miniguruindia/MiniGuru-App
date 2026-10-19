"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/schoolJoinRoutes.ts
// Child -> school join requests (Oct 2026). Mounted at /school-join.
//   child:  GET /school-lookup?loginId=   POST /request   GET /mine   POST /:id/cancel
//   school: GET /pending                  POST /:id/approve   POST /:id/decline
// Approving creates the same ChildProfile link as "Add existing child"; the
// child keeps their own account, Goins and projects.
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticateToken);
function normaliseLoginId(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (!v)
        return '';
    return v.includes('@') ? v : v + '@miniguru.in';
}
function schoolLabel(u) {
    return (u.guardianInfo && u.guardianInfo.institutionName) || u.name;
}
async function loadMe(req) {
    const id = req.user?.id;
    return prismaClient_1.default.user.findUnique({
        where: { id },
        select: { id: true, name: true, age: true, role: true, isMentor: true, email: true },
    });
}
async function findSchool(loginId) {
    const school = await prismaClient_1.default.user.findUnique({
        where: { email: loginId },
        select: { id: true, name: true, isMentor: true, mentorType: true, guardianInfo: true },
    });
    if (!school || !school.isMentor || !(school.mentorType === 'SCHOOL' || school.mentorType === 'TLAB'))
        return null;
    return school;
}
// GET /school-join/school-lookup?loginId=sunrise.ujjain
router.get('/school-lookup', async (req, res) => {
    try {
        const loginId = normaliseLoginId(req.query.loginId);
        if (!loginId)
            return res.status(400).json({ message: "Enter your school's login ID" });
        const school = await findSchool(loginId);
        if (!school)
            return res.status(404).json({ message: 'No school found with that login ID. Ask your teacher for it.' });
        return res.json({ schoolName: schoolLabel(school), city: school.guardianInfo?.city ?? null });
    }
    catch (e) {
        console.error('school lookup error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /school-join/request { loginId }
router.post('/request', async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me)
            return res.status(403).json({ message: 'Please log in again.' });
        if (me.role !== 'USER')
            return res.status(403).json({ message: 'This is an Admin account. Only a child\'s own (learner) account can ask to join a school - log in with a child account to test.' });
        if (me.isMentor)
            return res.status(403).json({ message: 'This is a Parent / School account. Only a child\'s own (learner) account can ask to join a school. If this child registered as a Parent by mistake, ask MiniGuru to change the account type.' });
        const loginId = normaliseLoginId(req.body?.loginId);
        const school = loginId ? await findSchool(loginId) : null;
        if (!school)
            return res.status(404).json({ message: 'No school found with that login ID. Ask your teacher for it.' });
        const inSchool = await prismaClient_1.default.childProfile.findFirst({ where: { linkedUserId: me.id, isActive: true }, select: { id: true } });
        if (inSchool)
            return res.status(400).json({ message: 'You are already in a school or family list.' });
        const pendingAll = await prismaClient_1.default.schoolJoinRequest.count({ where: { childUserId: me.id, status: 'PENDING' } });
        if (pendingAll >= 3)
            return res.status(400).json({ message: 'You already have 3 waiting requests. Cancel one first.' });
        const dup = await prismaClient_1.default.schoolJoinRequest.findFirst({ where: { childUserId: me.id, schoolId: school.id, status: 'PENDING' } });
        if (dup)
            return res.status(400).json({ message: 'You already asked this school. Please wait for the teacher.' });
        const reqRow = await prismaClient_1.default.schoolJoinRequest.create({ data: { childUserId: me.id, schoolId: school.id } });
        try {
            await (0, notificationService_1.notifyUser)({
                userId: school.id,
                type: 'school_join_request',
                emoji: '🏫',
                message: `${me.name} wants to join your school. Open My Account to approve or decline.`,
            });
        }
        catch (e) { /* best effort */ }
        return res.status(201).json({ message: 'Request sent', id: reqRow.id, schoolName: schoolLabel(school) });
    }
    catch (e) {
        console.error('join request error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// GET /school-join/mine -> is the child already in a school, and their open requests
router.get('/mine', async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me)
            return res.status(401).json({ message: 'Unauthorized' });
        const link = await prismaClient_1.default.childProfile.findFirst({ where: { linkedUserId: me.id, isActive: true }, select: { guardianId: true } });
        let inSchool = null;
        if (link) {
            const g = await prismaClient_1.default.user.findUnique({ where: { id: link.guardianId }, select: { name: true, mentorType: true, guardianInfo: true } });
            if (g)
                inSchool = { name: schoolLabel(g) };
        }
        const rows = await prismaClient_1.default.schoolJoinRequest.findMany({
            where: { childUserId: me.id, status: { in: ['PENDING', 'DECLINED'] } },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });
        const schools = rows.length
            ? await prismaClient_1.default.user.findMany({ where: { id: { in: rows.map((r) => r.schoolId) } }, select: { id: true, name: true, guardianInfo: true } })
            : [];
        const nameOf = new Map(schools.map((s) => [s.id, schoolLabel(s)]));
        return res.json({
            isMentor: me.isMentor,
            inSchool,
            requests: rows.map((r) => ({ id: r.id, status: r.status, schoolName: nameOf.get(r.schoolId) || 'School', createdAt: r.createdAt })),
        });
    }
    catch (e) {
        console.error('join mine error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /school-join/:id/cancel (child)
router.post('/:id/cancel', async (req, res) => {
    try {
        const me = await loadMe(req);
        const row = await prismaClient_1.default.schoolJoinRequest.findUnique({ where: { id: req.params.id } });
        if (!me || !row || row.childUserId !== me.id || row.status !== 'PENDING')
            return res.status(404).json({ message: 'Request not found' });
        await prismaClient_1.default.schoolJoinRequest.update({ where: { id: row.id }, data: { status: 'CANCELLED', decidedAt: new Date() } });
        return res.json({ message: 'Request cancelled' });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// GET /school-join/pending (school)
router.get('/pending', async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me || !me.isMentor)
            return res.json({ requests: [] });
        const rows = await prismaClient_1.default.schoolJoinRequest.findMany({ where: { schoolId: me.id, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 100 });
        const kids = rows.length
            ? await prismaClient_1.default.user.findMany({ where: { id: { in: rows.map((r) => r.childUserId) } }, select: { id: true, name: true, age: true, email: true } })
            : [];
        const kid = new Map(kids.map((k) => [k.id, k]));
        return res.json({
            requests: rows.map((r) => ({
                id: r.id,
                createdAt: r.createdAt,
                childName: kid.get(r.childUserId)?.name ?? 'Child',
                childAge: kid.get(r.childUserId)?.age ?? null,
                loginId: kid.get(r.childUserId)?.email ?? null,
            })),
        });
    }
    catch (e) {
        console.error('join pending error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
async function loadOwnPending(req) {
    const me = await loadMe(req);
    if (!me || !me.isMentor)
        return { me: null, row: null };
    const row = await prismaClient_1.default.schoolJoinRequest.findUnique({ where: { id: req.params.id } });
    if (!row || row.schoolId !== me.id || row.status !== 'PENDING')
        return { me, row: null };
    return { me, row };
}
// POST /school-join/:id/approve (school)
router.post('/:id/approve', async (req, res) => {
    try {
        const { me, row } = await loadOwnPending(req);
        if (!row)
            return res.status(404).json({ message: 'Request not found or already handled' });
        const child = await prismaClient_1.default.user.findUnique({ where: { id: row.childUserId }, select: { id: true, name: true, age: true, role: true, isMentor: true } });
        if (!child || child.role !== 'USER' || child.isMentor)
            return res.status(400).json({ message: 'This account can no longer be added.' });
        const active = await prismaClient_1.default.childProfile.findFirst({ where: { linkedUserId: child.id, isActive: true }, select: { id: true } });
        if (active) {
            await prismaClient_1.default.schoolJoinRequest.update({ where: { id: row.id }, data: { status: 'DECLINED', decidedAt: new Date() } });
            return res.status(400).json({ message: 'This child is already linked to a school or family list.' });
        }
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        const pinHash = await bcryptjs_1.default.hash(pin, 10);
        const earlier = await prismaClient_1.default.childProfile.findFirst({ where: { guardianId: me.id, linkedUserId: child.id }, select: { id: true } });
        const select = { id: true, name: true, age: true, grade: true, score: true, isActive: true, createdAt: true };
        const profile = earlier
            ? await prismaClient_1.default.childProfile.update({ where: { id: earlier.id }, data: { isActive: true, pinHash }, select })
            : await prismaClient_1.default.childProfile.create({ data: { guardianId: me.id, name: child.name, age: child.age, pinHash, linkedUserId: child.id }, select });
        await prismaClient_1.default.schoolJoinRequest.update({ where: { id: row.id }, data: { status: 'APPROVED', decidedAt: new Date() } });
        // other waiting requests from this child are now moot
        await prismaClient_1.default.schoolJoinRequest.updateMany({
            where: { childUserId: child.id, status: 'PENDING' },
            data: { status: 'CANCELLED', decidedAt: new Date() },
        });
        try {
            await (0, notificationService_1.notifyUser)({ userId: child.id, type: 'school_join_approved', emoji: '🎉', message: 'Your school accepted you! You are now in their learner list.' });
        }
        catch (e) { /* best effort */ }
        return res.json({ message: 'Child added', child: profile, pin });
    }
    catch (e) {
        console.error('join approve error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /school-join/:id/decline (school)
router.post('/:id/decline', async (req, res) => {
    try {
        const { row } = await loadOwnPending(req);
        if (!row)
            return res.status(404).json({ message: 'Request not found or already handled' });
        await prismaClient_1.default.schoolJoinRequest.update({ where: { id: row.id }, data: { status: 'DECLINED', decidedAt: new Date() } });
        try {
            await (0, notificationService_1.notifyUser)({ userId: row.childUserId, type: 'school_join_declined', emoji: '🏫', message: 'The school did not accept your request. You can check the login ID or ask your teacher.' });
        }
        catch (e) { /* best effort */ }
        return res.json({ message: 'Request declined' });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
