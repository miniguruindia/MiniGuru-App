"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Every route in this file is admin-only.
router.use(authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin);
// ── Helpers ────────────────────────────────────────────────────────────────
function generatePassword() {
    // e.g. "Edu@a1b2c3d4" — easy enough to read/type, ~32 bits of entropy
    return 'Edu@' + crypto_1.default.randomBytes(4).toString('hex');
}
async function buildUniqueSchoolEmail(institutionName) {
    const base = institutionName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '') || 'school';
    let email = `${base}@miniguru.in`;
    let suffix = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await prismaClient_1.default.user.findUnique({ where: { email } })) {
        suffix += 1;
        email = `${base}${suffix}@miniguru.in`;
    }
    return email;
}
// ── GET /admin/schools — list all School / T-LAB accounts ─────────────────
router.get('/schools', async (req, res) => {
    try {
        const schools = await prismaClient_1.default.user.findMany({
            where: { isMentor: true, mentorType: { in: ['SCHOOL', 'TLAB'] } },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                mentorType: true,
                guardianInfo: true,
                score: true,
                createdAt: true,
                children: { select: { id: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(schools.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            phoneNumber: s.phoneNumber,
            mentorType: s.mentorType,
            institutionName: s.guardianInfo?.institutionName ?? null,
            city: s.guardianInfo?.city ?? null,
            state: s.guardianInfo?.state ?? null,
            pincode: s.guardianInfo?.pincode ?? null,
            studentCount: s.children?.length ?? 0,
            createdAt: s.createdAt,
        })));
    }
    catch (e) {
        console.error('List schools error:', e);
        res.status(500).json({ message: 'Failed to fetch school accounts' });
    }
});
// ── POST /admin/create-school-account ──────────────────────────────────────
router.post('/create-school-account', async (req, res) => {
    try {
        const { institutionName, mentorType, contactName, contactPhone, city, state, pincode, } = req.body;
        if (!institutionName || !mentorType) {
            return res.status(400).json({ message: 'institutionName and mentorType are required' });
        }
        if (!['SCHOOL', 'TLAB'].includes(mentorType)) {
            return res.status(400).json({ message: 'mentorType must be SCHOOL or TLAB' });
        }
        const email = await buildUniqueSchoolEmail(institutionName);
        const plainPassword = generatePassword();
        const passwordHash = await bcryptjs_1.default.hash(plainPassword, 10);
        const user = await prismaClient_1.default.user.create({
            data: {
                name: contactName || institutionName,
                email,
                phoneNumber: contactPhone || null,
                passwordHash,
                age: 30,
                role: 'USER',
                score: 100,
                isMentor: true,
                mentorType,
                guardianInfo: {
                    institutionName,
                    city: city ?? null,
                    state: state ?? null,
                    pincode: pincode ?? null,
                    isVerified: true, // admin-created — verified by definition
                },
            },
            select: { id: true, name: true, email: true, mentorType: true, createdAt: true },
        });
        return res.status(201).json({
            message: 'School account created',
            account: user,
            credentials: { email, password: plainPassword },
        });
    }
    catch (e) {
        console.error('Create school account error:', e);
        res.status(500).json({ message: 'Failed to create school account' });
    }
});
// ── POST /admin/users/:id/reset-password ───────────────────────────────────
// Generic admin password reset — works for any account (school, parent, child).
router.post('/users/:id/reset-password', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prismaClient_1.default.user.findUnique({ where: { id } });
        if (!user)
            return res.status(404).json({ message: 'Account not found' });
        const plainPassword = generatePassword();
        const passwordHash = await bcryptjs_1.default.hash(plainPassword, 10);
        await prismaClient_1.default.user.update({ where: { id }, data: { passwordHash } });
        return res.json({
            message: 'Password reset',
            credentials: { email: user.email, password: plainPassword },
        });
    }
    catch (e) {
        console.error('Admin reset password error:', e);
        res.status(500).json({ message: 'Failed to reset password' });
    }
});
exports.default = router;
