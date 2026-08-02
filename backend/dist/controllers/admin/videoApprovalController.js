"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllDrafts = exports.rejectProject = exports.approveProject = exports.ApprovalError = exports.getPendingProjects = void 0;
exports.extractYouTubeId = extractYouTubeId;
exports.publishAndAwardProject = publishAndAwardProject;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const logger_1 = __importDefault(require("../../logger"));
const { setVideoPublic, deleteVideo } = require('../../services/youtubeUploadService');
function extractYouTubeId(videoUrl) {
    const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : videoUrl;
}
// GET /admin/projects/pending
const getPendingProjects = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        const [projects, total] = await Promise.all([
            prismaClient_1.default.project.findMany({
                where: { status: 'pending' },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    category: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'asc' },
                skip,
                take: limit,
            }),
            prismaClient_1.default.project.count({ where: { status: 'pending' } }),
        ]);
        logger_1.default.info(`Admin fetched pending projects: ${total} total`);
        return res.status(200).json({
            projects,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        logger_1.default.error(`Error fetching pending projects: ${error.message}`);
        return res.status(500).json({ message: 'Failed to fetch pending projects.' });
    }
};
exports.getPendingProjects = getPendingProjects;
// Thrown by publishAndAwardProject() so callers (the HTTP route AND the AI
// auto-approve path in projectController.ts) can distinguish "not found" /
// "wrong status" / "YouTube failed" without either caller re-implementing
// the same checks.
class ApprovalError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'ApprovalError';
    }
}
exports.ApprovalError = ApprovalError;
// Shared core of "approve a project": publish on YouTube (if it has a video)
// + award Goins split equally across owner and collaborators. Used by the
// admin-triggered approveProject route below AND by the AI auto-approve
// path (confidence >= 0.85 APPROVE) in projectController.ts — both must
// stay in sync, which is exactly why this now lives in one place instead
// of two copies.
async function publishAndAwardProject(id) {
    const project = await prismaClient_1.default.project.findUnique({ where: { id } });
    if (!project)
        throw new ApprovalError('Project not found.', 404);
    // 'rejected' is allowed here too — admin can change their mind (or a
    // video that was fixed via the admin edit page's video-replace feature
    // needs re-approving). Only 'published' (already live) is blocked.
    if (!['pending', 'rejected'].includes(project.status)) {
        throw new ApprovalError(`Cannot approve — status is '${project.status}', expected 'pending' or 'rejected'.`, 400);
    }
    // ── YouTube ───────────────────────────────────────────────────
    if (project.video?.url) {
        try {
            await setVideoPublic(extractYouTubeId(project.video.url));
            logger_1.default.info(`YouTube video set to PUBLIC for project ${id}`);
        }
        catch (ytError) {
            logger_1.default.error(`YouTube publish failed: ${ytError.message}`);
            throw new ApprovalError('Failed to publish on YouTube. Project not approved.', 502);
        }
    }
    else {
        logger_1.default.warn(`Project ${id} has no video URL — skipping YouTube step`);
    }
    // ── Re-calculate material cost in Goins ───────────────────────
    // BUGFIX: this used to query prisma.product — the old own-shop model
    // from before the Amazon-affiliate architecture (Rule 26). No Material
    // ID has ever matched a Product ID, so this lookup silently returned
    // empty every single time, meaning materialGoins was ALWAYS 0 and the
    // "2x materials refund" bonus has never actually paid out on any
    // project, ever. Confirmed against a real account's exact numbers.
    let materialGoins = 0;
    const mats = project.materials;
    if (mats && mats.length > 0) {
        const materialIds = mats.map(m => m.productId);
        const materialRecords = await prismaClient_1.default.material.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, goinsPrice: true },
        });
        const priceMap = new Map(materialRecords.map(m => [m.id, m.goinsPrice]));
        for (const mat of mats) {
            const rate = priceMap.get(mat.productId) ?? 0;
            materialGoins += rate * mat.quantity;
        }
    }
    const BASE_REWARD = 50;
    const materialRefund = Math.round(materialGoins * 2);
    // ── STEAM Challenge bonus — in ADDITION to the normal award ─────────────
    // If this project was made for a challenge (set at upload time — see
    // createProject), the challenge's goinsReward is paid out on top of the
    // base + material refund, once, here, on approval. Never re-awarded on
    // a re-approval attempt since a project can only be approved from
    // 'pending' once (see the status guard above).
    let challengeBonus = 0;
    if (project.challengeId) {
        try {
            const challenge = await prismaClient_1.default.challenge.findUnique({ where: { id: project.challengeId } });
            if (challenge)
                challengeBonus = challenge.goinsReward;
        }
        catch (challengeError) {
            logger_1.default.warn(`Challenge lookup failed during approval, awarding base only: ${challengeError.message}`);
        }
    }
    const totalGoins = BASE_REWARD + materialRefund + challengeBonus;
    // ─────────────────────────────────────────────────────────────
    // ── Shared/group projects — split equally across owner + collaborators ──
    // Confirmed product decision: always equal split, no custom percentages.
    // Owner absorbs any rounding remainder so Goins are never lost. The
    // challenge bonus is folded into totalGoins above, so it's split the
    // exact same way — a team that joins a challenge together shares the
    // bonus equally too, same as the base award.
    const collaborators = project.collaborators || [];
    const recipientIds = [project.userId, ...collaborators.map((c) => c.userId)];
    const shareEach = Math.floor(totalGoins / recipientIds.length);
    const remainder = totalGoins - shareEach * recipientIds.length;
    const reasonParts = [`base +${BASE_REWARD}`];
    if (materialRefund > 0)
        reasonParts.push(`materials +${materialRefund}`);
    if (challengeBonus > 0)
        reasonParts.push(`challenge bonus +${challengeBonus}`);
    const isTeam = recipientIds.length > 1;
    const [updated] = await prismaClient_1.default.$transaction([
        prismaClient_1.default.project.update({
            where: { id },
            data: {
                status: 'published',
                challengeGoinsAwarded: challengeBonus > 0 ? challengeBonus : undefined,
            },
        }),
        ...recipientIds.map((recipientId, idx) => {
            const share = idx === 0 ? shareEach + remainder : shareEach;
            const reason = `"${project.title}" approved: +${share} Goins ` +
                `(${reasonParts.join(', ')}${isTeam ? `, split ${recipientIds.length} ways` : ''})`;
            return prismaClient_1.default.user.update({
                where: { id: recipientId },
                data: {
                    score: { increment: share },
                    // updatedScore stores the DELTA of this transaction (matching
                    // the existing convention already used by /admin/goins/adjust
                    // and read by /admin/goins/history) — NOT the resulting total.
                    scoreHistory: { push: { time: new Date(), updatedScore: share, reason } },
                },
            });
        }),
    ]);
    logger_1.default.info(`Project ${id} approved. ${totalGoins} Goins split across ${recipientIds.length} ` +
        `recipient(s) (${shareEach} each${remainder > 0 ? `, +${remainder} rounding to owner` : ''}) ` +
        `(base: ${BASE_REWARD}, material refund 2x${Math.round(materialGoins)}: ${materialRefund}` +
        `${challengeBonus > 0 ? `, challenge bonus: ${challengeBonus}` : ''})`);
    return {
        project: updated,
        goinsAwarded: totalGoins,
        breakdown: { base: BASE_REWARD, materialRefund, challengeBonus },
        recipients: recipientIds.length,
    };
}
// POST /admin/projects/:id/approve
const approveProject = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await publishAndAwardProject(id);
        return res.status(200).json({
            message: 'Project approved and published on YouTube.',
            ...result,
        });
    }
    catch (error) {
        if (error instanceof ApprovalError) {
            return res.status(error.status).json({ message: error.message });
        }
        logger_1.default.error(`Error approving project ${id}: ${error.message}`);
        return res.status(500).json({ message: 'Failed to approve project.' });
    }
};
exports.approveProject = approveProject;
// POST /admin/projects/:id/reject
const rejectProject = async (req, res) => {
    const { id } = req.params;
    const { reason = '' } = req.body;
    const deleteFromYouTube = req.query.deleteFromYoutube === 'true';
    try {
        const project = await prismaClient_1.default.project.findUnique({ where: { id } });
        if (!project)
            return res.status(404).json({ message: 'Project not found.' });
        if (project.status !== 'pending')
            return res.status(400).json({
                message: `Cannot reject — status is '${project.status}', expected 'pending'.`,
            });
        if (deleteFromYouTube && project.video?.url) {
            try {
                await deleteVideo(extractYouTubeId(project.video.url));
                logger_1.default.info(`YouTube video deleted for project ${id}`);
            }
            catch (ytError) {
                logger_1.default.warn(`YouTube delete failed (non-fatal): ${ytError.message}`);
            }
        }
        const updated = await prismaClient_1.default.project.update({
            where: { id },
            data: { status: 'rejected' },
        });
        logger_1.default.info(`Project ${id} rejected. Reason: ${reason || 'none'}`);
        return res.status(200).json({ message: 'Project rejected.', project: updated, reason });
    }
    catch (error) {
        logger_1.default.error(`Error rejecting project ${id}: ${error.message}`);
        return res.status(500).json({ message: 'Failed to reject project.' });
    }
};
exports.rejectProject = rejectProject;
// GET /admin/drafts
const getAllDrafts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        const [drafts, total] = await Promise.all([
            prismaClient_1.default.project.findMany({
                where: { status: 'draft' },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    category: { select: { id: true, name: true } },
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
            }),
            prismaClient_1.default.project.count({ where: { status: 'draft' } }),
        ]);
        logger_1.default.info(`Admin fetched drafts: ${total} total`);
        return res.status(200).json({
            drafts,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        logger_1.default.error(`Error fetching drafts: ${error.message}`);
        return res.status(500).json({ message: 'Failed to fetch drafts.' });
    }
};
exports.getAllDrafts = getAllDrafts;
