"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// POST /plan-ids   (logged-in; works inside a mentor's child session too)
// Gives a planning sheet its permanent ID: MG-<SCHOOL>-<INITIALS>-<NNNN>.
// The number comes from ONE atomic counter (Mongo findAndModify with $inc), so two
// children can never get the same number. The first number handed out is 42,
// because 41 videos already exist (they get 1-41 later).
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const resolveSubject_1 = require("../middleware/resolveSubject");
const planCode_1 = require("../utils/planCode");
const router = (0, express_1.Router)();
const FIRST_NUMBER = 42;
router.post('/', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, async (req, res) => {
    try {
        const authedId = req.user?.userId;
        if (!authedId)
            return res.status(401).json({ error: 'Unauthorized' });
        // The child's own account when a mentor is in a PIN session, else the logged-in user.
        const ownerId = req.subject?.isChild ? (req.subject.linkedUserId || authedId) : authedId;
        const owner = await prismaClient_1.default.user.findUnique({
            where: { id: ownerId },
            select: { name: true, schoolName: true },
        });
        const name = req.subject?.isChild ? req.subject.name : owner?.name;
        let school = owner?.schoolName ?? null;
        if (!school && req.subject?.isChild && req.subject.guardianId) {
            const g = await prismaClient_1.default.user.findUnique({ where: { id: req.subject.guardianId }, select: { schoolName: true } });
            school = g?.schoolName ?? null;
        }
        const r = await prismaClient_1.default.$runCommandRaw({
            findAndModify: 'plan_counter',
            query: { _id: 'plan' },
            update: { $inc: { seq: 1 } },
            new: true,
            upsert: true,
        });
        const seq = Number(r?.value?.seq);
        if (!Number.isFinite(seq) || seq < 1)
            return res.status(500).json({ error: 'Could not create an ID right now.' });
        const number = seq + FIRST_NUMBER - 1;
        const code = (0, planCode_1.buildPlanCode)(school, name, number);
        const row = await prismaClient_1.default.planSheet.create({
            data: { number, code, userId: ownerId },
        });
        return res.json({ code, number, createdAt: row.createdAt });
    }
    catch (e) {
        console.error('plan-ids error:', e?.message || e);
        return res.status(500).json({ error: 'Could not create an ID right now.' });
    }
});
exports.default = router;
