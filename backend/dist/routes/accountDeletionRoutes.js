"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/accountDeletionRoutes.ts
// Self-service "Delete my account" (Oct 2026). Mounted at /account-deletion.
//   any user:  GET /mine   POST /request { mode, confirm:'DELETE', password }   POST /:id/cancel
//   guardian:  GET /pending   POST /:id/approve { mode }   POST /:id/decline
//   admin:     GET /admin/list
// Nothing is deleted here. A request waits 7 days (SCHEDULED), then an admin reviews
// it in People and deletes with the existing safe delete (students stay, optional
// keep-content). A child who is in a parent's or school's list can only ASK
// (AWAITING_GUARDIAN); the parent or school decides.
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticateToken);
const db = prismaClient_1.default;
const WAIT_DAYS = 7;
const OPEN = ['AWAITING_GUARDIAN', 'SCHEDULED'];
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
async function loadMe(req) {
    const id = req.user?.id;
    if (!id)
        return null;
    return db.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, email: true, isMentor: true, passwordHash: true } });
}
function shape(r) {
    return { id: r.id, status: r.status, mode: r.mode, requestedAt: r.requestedAt, deleteAfter: r.deleteAfter ?? null };
}
// GET /account-deletion/mine
router.get('/mine', async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me)
            return res.status(401).json({ message: 'Unauthorized' });
        const link = await db.childProfile.findFirst({ where: { linkedUserId: me.id, isActive: true }, select: { guardianId: true } });
        let guardianName = null;
        if (link) {
            const g = await db.user.findUnique({ where: { id: link.guardianId }, select: { name: true, guardianInfo: true } });
            guardianName = (g && ((g.guardianInfo && g.guardianInfo.institutionName) || g.name)) || null;
        }
        const open = await db.accountDeletionRequest.findFirst({ where: { userId: me.id, status: { in: OPEN } }, orderBy: { requestedAt: 'desc' } });
        return res.json({
            canDelete: me.role === 'USER',
            mustAsk: !!link,
            guardianName,
            request: open ? shape(open) : null,
        });
    }
    catch (e) {
        console.error('deletion mine error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /account-deletion/request
router.post('/request', async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me)
            return res.status(401).json({ message: 'Please log in again.' });
        if (me.role !== 'USER')
            return res.status(403).json({ message: 'Admin accounts cannot be deleted here.' });
        const { mode, confirm, password } = req.body || {};
        if (confirm !== 'DELETE')
            return res.status(400).json({ message: 'Type DELETE to confirm.' });
        if (mode !== 'keep' && mode !== 'remove')
            return res.status(400).json({ message: 'Choose what happens to your projects.' });
        const okPw = typeof password === 'string' && password.length > 0 && await bcryptjs_1.default.compare(password, me.passwordHash);
        if (!okPw)
            return res.status(400).json({ message: 'That password is not right.' });
        const already = await db.accountDeletionRequest.findFirst({ where: { userId: me.id, status: { in: OPEN } } });
        if (already)
            return res.status(400).json({ message: 'A deletion request is already open for this account.' });
        const link = await db.childProfile.findFirst({ where: { linkedUserId: me.id, isActive: true }, select: { guardianId: true } });
        const now = new Date();
        if (link) {
            const row = await db.accountDeletionRequest.create({ data: { userId: me.id, status: 'AWAITING_GUARDIAN', mode, requestedAt: now } });
            try {
                await (0, notificationService_1.notifyUser)({ userId: link.guardianId, type: 'deletion_request', emoji: '⚠️',
                    message: `${me.name} would like their MiniGuru account deleted. Open My Account to decide.` });
            }
            catch (e) { /* best effort */ }
            return res.status(201).json({ message: 'Asked', request: shape(row) });
        }
        const row = await db.accountDeletionRequest.create({ data: { userId: me.id, status: 'SCHEDULED', mode, requestedAt: now, deleteAfter: addDays(now, WAIT_DAYS) } });
        return res.status(201).json({ message: 'Scheduled', request: shape(row) });
    }
    catch (e) {
        console.error('deletion request error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /account-deletion/:id/cancel (the person, or their parent / school)
router.post('/:id/cancel', async (req, res) => {
    try {
        const me = await loadMe(req);
        const row = await db.accountDeletionRequest.findUnique({ where: { id: req.params.id } }).catch(() => null);
        if (!me || !row || !OPEN.includes(row.status))
            return res.status(404).json({ message: 'Request not found' });
        let allowed = row.userId === me.id;
        if (!allowed) {
            const link = await db.childProfile.findFirst({ where: { linkedUserId: row.userId, guardianId: me.id, isActive: true }, select: { id: true } });
            allowed = !!link;
        }
        if (!allowed)
            return res.status(404).json({ message: 'Request not found' });
        await db.accountDeletionRequest.update({ where: { id: row.id }, data: { status: 'CANCELLED', decidedAt: new Date(), decidedById: me.id } });
        return res.json({ message: 'Cancelled' });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// GET /account-deletion/pending (parent or school: requests from the children in their list)
router.get('/pending', async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me || !me.isMentor)
            return res.json({ requests: [] });
        const links = await db.childProfile.findMany({ where: { guardianId: me.id, isActive: true, linkedUserId: { not: null } }, select: { linkedUserId: true } });
        const ids = links.map((l) => l.linkedUserId).filter(Boolean);
        if (!ids.length)
            return res.json({ requests: [] });
        const rows = await db.accountDeletionRequest.findMany({ where: { userId: { in: ids }, status: 'AWAITING_GUARDIAN' }, orderBy: { requestedAt: 'asc' }, take: 100 });
        const kids = rows.length ? await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } }) : [];
        const nm = new Map(kids.map((k) => [k.id, k.name]));
        return res.json({ requests: rows.map((r) => ({ id: r.id, childName: nm.get(r.userId) || 'Child', requestedAt: r.requestedAt, mode: r.mode })) });
    }
    catch (e) {
        console.error('deletion pending error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
async function guardianRow(req) {
    const me = await loadMe(req);
    if (!me || !me.isMentor)
        return { error: 'Not found' };
    const row = await db.accountDeletionRequest.findUnique({ where: { id: req.params.id } }).catch(() => null);
    if (!row || row.status !== 'AWAITING_GUARDIAN')
        return { error: 'Request not found' };
    const link = await db.childProfile.findFirst({ where: { linkedUserId: row.userId, guardianId: me.id, isActive: true }, select: { id: true } });
    if (!link)
        return { error: 'Request not found' };
    return { me, row };
}
// POST /account-deletion/:id/approve { mode }
router.post('/:id/approve', async (req, res) => {
    try {
        const g = await guardianRow(req);
        if (g.error)
            return res.status(404).json({ message: g.error });
        const mode = req.body?.mode === 'remove' ? 'remove' : 'keep';
        const now = new Date();
        await db.accountDeletionRequest.update({ where: { id: g.row.id }, data: { status: 'SCHEDULED', mode, deleteAfter: addDays(now, WAIT_DAYS), decidedAt: now, decidedById: g.me.id } });
        return res.json({ message: 'Scheduled' });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /account-deletion/:id/decline
router.post('/:id/decline', async (req, res) => {
    try {
        const g = await guardianRow(req);
        if (g.error)
            return res.status(404).json({ message: g.error });
        await db.accountDeletionRequest.update({ where: { id: g.row.id }, data: { status: 'DECLINED', decidedAt: new Date(), decidedById: g.me.id } });
        return res.json({ message: 'Declined' });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// GET /account-deletion/admin/list
router.get('/admin/list', authMiddleware_1.authorizeAdmin, async (_req, res) => {
    try {
        const rows = await db.accountDeletionRequest.findMany({ where: { status: { in: OPEN } }, orderBy: { requestedAt: 'asc' }, take: 200 });
        const users = rows.length ? await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, email: true } }) : [];
        const u = new Map(users.map((x) => [x.id, x]));
        const now = Date.now();
        return res.json({
            requests: rows.map((r) => ({
                ...shape(r),
                userId: r.userId,
                name: u.get(r.userId)?.name ?? '(deleted)',
                email: u.get(r.userId)?.email ?? '',
                due: r.status === 'SCHEDULED' && r.deleteAfter && new Date(r.deleteAfter).getTime() <= now,
            })),
        });
    }
    catch (e) {
        console.error('deletion admin list error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
