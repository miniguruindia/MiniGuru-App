"use strict";
// backend/src/middleware/resolveSubject.ts
//
// WHAT THIS DOES:
//   Reads the optional X-Child-Profile-Id header sent by Flutter when a mentor
//   has started a child session (SessionState.isChildSession === true).
//
//   If the header is present → verify the child belongs to the requesting
//   mentor, then attach req.subject = child's data (name, score, id etc.)
//
//   If the header is absent  → req.subject = req.user (normal mentor/user flow)
//
// USAGE:
//   Mount AFTER authenticateToken on any route that needs child-aware data.
//   Controllers then read req.subject instead of req.user for profile, score,
//   analytics, badges, and notifications.
//
// DOES NOT AFFECT:
//   - Wallet (wallet.balance is always the MENTOR's real money)
//   - Orders  (always placed by the guardian)
//   - Auth    (JWT always belongs to the mentor/user)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSubject = resolveSubject;
exports.resolveOwnerUserId = resolveOwnerUserId;
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
async function resolveSubject(req, res, next) {
    // ── 1. Must have been authenticated first ──────────────────────────────
    if (!req.user?.userId) {
        res.status(401).json({ error: 'Unauthorized — resolveSubject requires authenticateToken first' });
        return;
    }
    const childProfileId = req.headers['x-child-profile-id'];
    // ── 2. No child session — subject is the logged-in user ───────────────
    if (!childProfileId || childProfileId.trim() === '') {
        try {
            const user = await prismaClient_1.default.user.findUnique({
                where: { id: req.user.userId },
                select: { id: true, name: true, score: true, age: true, profilePhoto: true },
            });
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            req.subject = {
                subjectId: user.id,
                name: user.name,
                score: user.score,
                age: user.age,
                avatar: user.profilePhoto ?? null,
                isChild: false,
            };
            next();
            return;
        }
        catch (err) {
            console.error('[resolveSubject] DB error (user lookup):', err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
    }
    // ── 3. Child session — validate and resolve ────────────────────────────
    try {
        const child = await prismaClient_1.default.childProfile.findUnique({
            where: { id: childProfileId },
            select: {
                id: true,
                guardianId: true,
                name: true,
                score: true,
                age: true,
                grade: true,
                avatar: true,
                linkedUserId: true,
            },
        });
        // 3a. Child must exist
        if (!child) {
            res.status(404).json({ error: 'Child profile not found' });
            return;
        }
        // 3b. Child must belong to the requesting mentor — SECURITY CHECK
        if (child.guardianId !== req.user.userId) {
            res.status(403).json({
                error: 'Forbidden — this child profile does not belong to the authenticated user',
            });
            return;
        }
        // 3c. All good — attach child as the active subject
        req.subject = {
            subjectId: child.id,
            name: child.name,
            score: child.score,
            age: child.age,
            grade: child.grade ?? null,
            avatar: child.avatar ?? null,
            isChild: true,
            guardianId: child.guardianId,
            linkedUserId: child.linkedUserId ?? null,
        };
        next();
    }
    catch (err) {
        console.error('[resolveSubject] DB error (child lookup):', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
// ---------------------------------------------------------------------------
// resolveOwnerUserId — shared helper for any write endpoint that needs to
// attribute an action (like, comment, rating, etc.) to the real acting
// person, not whoever's JWT is on the request.
//
// Mount `resolveSubject` on the route BEFORE calling this in the controller.
//
// Returns:
//   - the correct User.id string to write into the DB, OR
//   - null, having already sent an error response — caller should
//     `if (!ownerUserId) return;` immediately after calling this.
//
// This is the exact same logic already used inline in
// projectController.ts's createProject — pulled out here so new call sites
// (likes, comments, peer ratings) don't have to duplicate it.
// ---------------------------------------------------------------------------
function resolveOwnerUserId(req, res) {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    if (req.subject?.isChild) {
        if (!req.subject.linkedUserId) {
            res.status(400).json({
                error: "This child profile doesn't have an independent login set up yet, " +
                    'so this action can\'t be attributed correctly. Ask an admin to ' +
                    "complete the child's account setup (linkedUserId) first.",
            });
            return null;
        }
        return req.subject.linkedUserId;
    }
    return userId;
}
