"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// ─── POST /mentor/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { name, email, phoneNumber, password, mentorType, institutionName, city, state, pincode, age } = req.body;
        if (!name || !email || !phoneNumber || !password || !mentorType) {
            return res.status(400).json({ message: 'name, email, phoneNumber, password, mentorType are required' });
        }
        const existing = await prismaClient_1.default.user.findFirst({
            where: { OR: [{ email }, { phoneNumber }] }
        });
        if (existing) {
            return res.status(409).json({ message: 'Email or phone already registered' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await prismaClient_1.default.user.create({
            data: {
                name,
                email,
                phoneNumber,
                passwordHash,
                age: age ?? 25,
                isMentor: true,
                mentorType,
                guardianInfo: {
                    institutionName: institutionName ?? null,
                    city: city ?? null,
                    state: state ?? null,
                    pincode: pincode ?? null,
                    isVerified: false,
                },
            },
            select: {
                id: true, name: true, email: true, phoneNumber: true,
                isMentor: true, mentorType: true, guardianInfo: true,
                score: true, role: true, createdAt: true,
            }
        });
        return res.status(201).json({ message: 'Mentor registered successfully', user });
    }
    catch (err) {
        console.error('mentor register error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// ─── POST /mentor/children ────────────────────────────────────────────────────
router.post('/children', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { name, age, grade, pin } = req.body;
        if (!name || !age || !pin) {
            return res.status(400).json({ message: 'name, age, pin are required' });
        }
        if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
            return res.status(400).json({ message: 'PIN must be exactly 4 digits' });
        }
        const mentor = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
        if (!mentor || !mentor.isMentor) {
            return res.status(403).json({ message: 'Only mentor accounts can add children' });
        }
        const pinHash = await bcryptjs_1.default.hash(String(pin), 10);
        // Auto-generate login credentials
        const nameParts = name.trim().toLowerCase().split(' ');
        const baseEmail = nameParts.join('.') + '@miniguru.in';
        // Make email unique if already taken
        const existing = await prismaClient_1.default.user.findUnique({ where: { email: baseEmail } });
        const autoEmail = existing
            ? nameParts.join('.') + '.' + Math.floor(1000 + Math.random() * 9000) + '@miniguru.in'
            : baseEmail;
        // Create real User account for child — password is MG + PIN (6 chars)
        const autoPassword = 'MG' + String(pin);
        const passwordHash = await bcryptjs_1.default.hash(autoPassword, 10);
        const linkedUser = await prismaClient_1.default.user.create({
            data: {
                email: autoEmail,
                passwordHash,
                name,
                age: Number(age),
                phoneNumber: 'child_' + Date.now(),
                role: 'USER',
                score: 100,
                isMentor: false,
            }
        });
        const child = await prismaClient_1.default.childProfile.create({
            data: {
                guardianId: userId,
                name,
                age: Number(age),
                grade: grade ?? null,
                pinHash,
                linkedUserId: linkedUser.id,
            },
            select: {
                id: true, name: true, age: true, grade: true,
                avatar: true, score: true, isActive: true, createdAt: true,
            }
        });
        return res.status(201).json({
            message: 'Child added successfully',
            child,
            credentials: {
                email: autoEmail,
                password: autoPassword,
                note: 'Child can login independently with these credentials'
            }
        });
    }
    catch (err) {
        console.error('add child error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// ─── GET /mentor/children ─────────────────────────────────────────────────────
router.get('/children', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const children = await prismaClient_1.default.childProfile.findMany({
            where: { guardianId: userId, isActive: true },
            select: {
                id: true, name: true, age: true, grade: true,
                avatar: true, score: true, isActive: true, createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        return res.json({ children });
    }
    catch (err) {
        console.error('get children error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// ─── GET /mentor/children/:childId ───────────────────────────────────────────
router.get('/children/:childId', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { childId } = req.params;
        const child = await prismaClient_1.default.childProfile.findFirst({
            where: { id: childId, guardianId: userId, isActive: true },
            select: {
                id: true, name: true, age: true, grade: true,
                avatar: true, score: true, scoreHistory: true,
                isActive: true, createdAt: true, updatedAt: true,
            }
        });
        if (!child)
            return res.status(404).json({ message: 'Child not found' });
        return res.json({ child });
    }
    catch (err) {
        console.error('get child error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// ─── PUT /mentor/children/:childId ───────────────────────────────────────────
router.put('/children/:childId', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { childId } = req.params;
        const { name, age, grade, avatar } = req.body;
        const existing = await prismaClient_1.default.childProfile.findFirst({
            where: { id: childId, guardianId: userId }
        });
        if (!existing)
            return res.status(404).json({ message: 'Child not found' });
        const updated = await prismaClient_1.default.childProfile.update({
            where: { id: childId },
            data: {
                ...(name && { name }),
                ...(age && { age: Number(age) }),
                ...(grade !== undefined && { grade }),
                ...(avatar !== undefined && { avatar }),
            },
            select: {
                id: true, name: true, age: true, grade: true,
                avatar: true, score: true, isActive: true,
            }
        });
        return res.json({ message: 'Child updated', child: updated });
    }
    catch (err) {
        console.error('update child error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// ─── POST /mentor/children/:childId/verify-pin ───────────────────────────────
router.post('/children/:childId/verify-pin', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { childId } = req.params;
        const { pin } = req.body;
        if (!pin)
            return res.status(400).json({ message: 'PIN is required' });
        const child = await prismaClient_1.default.childProfile.findFirst({
            where: { id: childId, guardianId: userId, isActive: true }
        });
        if (!child)
            return res.status(404).json({ message: 'Child not found' });
        const valid = await bcryptjs_1.default.compare(String(pin), child.pinHash);
        if (!valid)
            return res.status(401).json({ message: 'Incorrect PIN' });
        return res.json({
            valid: true,
            child: {
                id: child.id, name: child.name, age: child.age,
                grade: child.grade, avatar: child.avatar, score: child.score,
            }
        });
    }
    catch (err) {
        console.error('verify pin error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// ─── DELETE /mentor/children/:childId (soft delete) ──────────────────────────
router.delete('/children/:childId', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { childId } = req.params;
        const existing = await prismaClient_1.default.childProfile.findFirst({
            where: { id: childId, guardianId: userId }
        });
        if (!existing)
            return res.status(404).json({ message: 'Child not found' });
        await prismaClient_1.default.childProfile.update({
            where: { id: childId },
            data: { isActive: false }
        });
        return res.json({ message: 'Child profile deactivated' });
    }
    catch (err) {
        console.error('delete child error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
