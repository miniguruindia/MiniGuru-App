"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/goinsTopupRoutes.ts
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Only admins may use these — checks role fresh from DB, same pattern as materialsRoutes.ts
function requireAdmin(req, res, next) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
// Allows EITHER an admin OR a mentor (parent/teacher) who is the guardian
// of the child making the request. Looks everything up fresh — safe even
// though req.user doesn't carry isMentor by default.
async function requireAdminOrGuardianMentor(req, res, next) {
    try {
        const actingUserId = req.user?.userId;
        const acting = await prismaClient_1.default.user.findUnique({
            where: { id: actingUserId },
            select: { role: true, isMentor: true },
        });
        if (acting?.role === 'ADMIN' || acting?.role === 'SUPERADMIN') {
            req.actingRole = 'ADMIN';
            return next();
        }
        if (acting?.isMentor === true) {
            // Confirm this mentor is actually the guardian of the requester
            const { id } = req.params;
            const request = await prismaClient_1.default.goinTopUpRequest.findUnique({ where: { id } });
            if (!request)
                return res.status(404).json({ error: 'Request not found' });
            const isGuardian = await prismaClient_1.default.childProfile.findFirst({
                where: {
                    guardianId: actingUserId,
                    OR: [
                        { linkedUserId: request.requesterId },
                        { id: request.requesterId },
                    ],
                },
            });
            if (isGuardian) {
                req.actingRole = 'MENTOR';
                return next();
            }
        }
        return res.status(403).json({ error: 'Not authorized to act on this request' });
    }
    catch (err) {
        console.error('requireAdminOrGuardianMentor error:', err);
        return res.status(500).json({ error: 'Authorization check failed' });
    }
}
// ─── POST /goins/topup/request — child hits a shortfall while planning ──────
router.post('/topup/request', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { amount, reason, projectDraftContext } = req.body;
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        const user = await prismaClient_1.default.user.findUnique({ where: { id: userId }, select: { name: true } });
        const request = await prismaClient_1.default.goinTopUpRequest.create({
            data: {
                requesterId: userId,
                requesterName: user?.name ?? 'Unknown',
                amount,
                reason: reason || null,
                projectDraftContext: projectDraftContext || null,
                status: 'PENDING',
            },
        });
        return res.json({ success: true, request });
    }
    catch (err) {
        console.error('POST /goins/topup/request error:', err);
        return res.status(500).json({ error: 'Failed to create request' });
    }
});
// ─── GET /goins/topup/mine — child checks status of their own requests ──────
router.get('/topup/mine', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const requests = await prismaClient_1.default.goinTopUpRequest.findMany({
            where: { requesterId: userId },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ requests });
    }
    catch (err) {
        console.error('GET /goins/topup/mine error:', err);
        return res.status(500).json({ error: 'Failed to fetch requests' });
    }
});
// ─── GET /admin/goins/topup/pending — admin sees ALL pending requests ───────
router.get('/admin/topup/pending', authMiddleware_1.authenticateToken, requireAdmin, async (_req, res) => {
    try {
        const pending = await prismaClient_1.default.goinTopUpRequest.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
        });
        return res.json({ requests: pending });
    }
    catch (err) {
        console.error('GET /admin/goins/topup/pending error:', err);
        return res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
});
// ─── GET /mentor/goins/topup/pending — mentor sees only THEIR children's requests ──
router.get('/mentor/topup/pending', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const guardianId = req.user?.userId;
        const children = await prismaClient_1.default.childProfile.findMany({
            where: { guardianId },
            select: { id: true, linkedUserId: true },
        });
        const requesterIds = children.flatMap(c => [c.id, c.linkedUserId]).filter(Boolean);
        if (requesterIds.length === 0)
            return res.json({ requests: [] });
        const pending = await prismaClient_1.default.goinTopUpRequest.findMany({
            where: { status: 'PENDING', requesterId: { in: requesterIds } },
            orderBy: { createdAt: 'asc' },
        });
        return res.json({ requests: pending });
    }
    catch (err) {
        console.error('GET /mentor/topup/pending error:', err);
        return res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
});
// ─── POST /admin/goins/topup/:id/approve ─────────────────────────────────────
router.post('/admin/topup/:id/approve', authMiddleware_1.authenticateToken, requireAdminOrGuardianMentor, async (req, res) => {
    try {
        const { id } = req.params;
        const actingUserId = req.user?.userId;
        const actingRole = req.actingRole || 'ADMIN';
        const request = await prismaClient_1.default.goinTopUpRequest.findUnique({ where: { id } });
        if (!request || request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request not pending' });
        }
        await prismaClient_1.default.$transaction([
            prismaClient_1.default.user.update({
                where: { id: request.requesterId },
                data: { score: { increment: request.amount } },
            }),
            prismaClient_1.default.goinTopUpRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    decidedById: actingUserId,
                    decidedByRole: actingRole,
                    decidedAt: new Date(),
                },
            }),
        ]);
        return res.json({ success: true });
    }
    catch (err) {
        console.error('POST /admin/topup/:id/approve error:', err);
        return res.status(500).json({ error: 'Failed to approve request' });
    }
});
// ─── POST /admin/goins/topup/:id/deny ────────────────────────────────────────
router.post('/admin/topup/:id/deny', authMiddleware_1.authenticateToken, requireAdminOrGuardianMentor, async (req, res) => {
    try {
        const { id } = req.params;
        const { denialReason } = req.body;
        const actingUserId = req.user?.userId;
        const actingRole = req.actingRole || 'ADMIN';
        await prismaClient_1.default.goinTopUpRequest.update({
            where: { id },
            data: {
                status: 'DENIED',
                decidedById: actingUserId,
                decidedByRole: actingRole,
                decidedAt: new Date(),
                denialReason: denialReason || null,
            },
        });
        return res.json({ success: true });
    }
    catch (err) {
        console.error('POST /admin/topup/:id/deny error:', err);
        return res.status(500).json({ error: 'Failed to deny request' });
    }
});
exports.default = router;
