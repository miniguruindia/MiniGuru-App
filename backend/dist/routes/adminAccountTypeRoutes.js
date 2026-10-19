"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/adminAccountTypeRoutes.ts
// Admin-only: change a person's account type when they chose the wrong one at sign-up
// (Oct 2026). Mounted at /admin.
//   PUT /admin/users/:userId/account-type  { type: 'individual' | 'parent' | 'school' | 'tlab', institutionName? }
// Child login IDs made by a school (phone starts with "child_") are not changed here.
// Goins, projects and everything else stay exactly as they are.
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin);
const db = prismaClient_1.default;
router.put('/users/:userId/account-type', async (req, res) => {
    try {
        const { userId } = req.params;
        const type = String(req.body?.type || '').toLowerCase();
        const institutionName = String(req.body?.institutionName || '').trim();
        if (!['individual', 'parent', 'school', 'tlab'].includes(type)) {
            return res.status(400).json({ message: 'Type must be individual, parent, school or tlab' });
        }
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        if (user.role === 'ADMIN' || user.role === 'SUPERADMIN')
            return res.status(400).json({ message: 'Admin accounts cannot be changed here' });
        if (String(user.phoneNumber || '').startsWith('child_')) {
            return res.status(400).json({ message: 'This is a child login made by a school. Use the school to add or remove it; its type is not changed here.' });
        }
        const kids = await db.childProfile.count({ where: { guardianId: userId, isActive: true } });
        const info = user.guardianInfo || {};
        let data;
        if (type === 'individual') {
            if (kids > 0) {
                return res.status(400).json({ message: `This account has ${kids} child(ren) linked. Remove them first (or move them) before making it an individual.` });
            }
            data = { isMentor: false, mentorType: null, guardianInfo: { unset: true } };
        }
        else if (type === 'parent') {
            data = { isMentor: true, mentorType: 'PARENT', guardianInfo: { set: { institutionName: info.institutionName ?? null, address: info.address ?? null, city: info.city ?? null, state: info.state ?? null, pincode: info.pincode ?? null, isVerified: !!info.isVerified } } };
        }
        else {
            const name = institutionName || info.institutionName || '';
            if (!name)
                return res.status(400).json({ message: 'Enter the school / T-LAB name.' });
            data = { isMentor: true, mentorType: type === 'school' ? 'SCHOOL' : 'TLAB', guardianInfo: { set: { institutionName: name, address: info.address ?? null, city: info.city ?? user.city ?? null, state: info.state ?? null, pincode: info.pincode ?? null, isVerified: !!info.isVerified } } };
        }
        const updated = await db.user.update({ where: { id: userId }, data, select: { id: true, name: true, isMentor: true, mentorType: true, guardianInfo: true } });
        console.log(`[admin] account type of ${userId} changed to ${type} by ${req.user?.id}`);
        return res.json({ message: 'Account type changed', user: updated });
    }
    catch (err) {
        console.error('account-type error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
