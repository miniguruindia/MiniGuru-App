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
// ── Helpers — institutional login ID generation (mirrors schoolAccountRoutes.ts) ──
function slugWord(w) {
    return (w || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
async function buildUniqueSchoolEmail(institutionName, city) {
    const firstWord = slugWord(institutionName.trim().split(/\s+/)[0]) || 'school';
    const cityWord = city ? slugWord(city.trim().split(/\s+/)[0]) : '';
    const base = cityWord ? `${firstWord}.${cityWord}` : firstWord;
    let email = `${base}@miniguru.in`;
    let suffix = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await prismaClient_1.default.user.findUnique({ where: { email } })) {
        suffix += 1;
        email = `${base}${suffix}@miniguru.in`;
    }
    return email;
}
// ─── POST /mentor/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { name, email, phoneNumber, password, mentorType, institutionName, city, state, pincode, age } = req.body;
        if (!name || !email || !phoneNumber || !password || !mentorType) {
            return res.status(400).json({ message: 'name, email, phoneNumber, password, mentorType are required' });
        }
        // Schools/T-LABs get an institutional login ID (firstword.city@miniguru.in) — same
        // pattern as the admin-created flow and the child self-registration ID. The email
        // they actually typed is kept as guardianEmail for password recovery / contact.
        let loginEmail = email;
        let guardianEmail = null;
        if ((mentorType === 'SCHOOL' || mentorType === 'TLAB') && institutionName) {
            loginEmail = await buildUniqueSchoolEmail(institutionName, city);
            guardianEmail = email;
        }
        const existing = await prismaClient_1.default.user.findFirst({
            where: { OR: [{ email: loginEmail }, { phoneNumber }] }
        });
        if (existing) {
            return res.status(409).json({ message: 'Email or phone already registered' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await prismaClient_1.default.user.create({
            data: {
                name,
                email: loginEmail,
                guardianEmail,
                phoneNumber,
                passwordHash,
                age: age ?? 25,
                score: 100,
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
                id: true, name: true, email: true, phoneNumber: true, guardianEmail: true,
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
// ─── Helpers ─────────────────────────────────────────────────────────────────
function getSchoolCode(name) {
    return name.split(/\s+/).map((w) => w[0]?.toLowerCase() || '').join('').slice(0, 4);
}
function getCityCode(city) {
    return city.toLowerCase().replace(/\s+/g, '').slice(0, 3);
}
// ─── POST /mentor/children/bulk ───────────────────────────────────────────────
router.post('/children/bulk', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { children } = req.body;
        if (!Array.isArray(children) || children.length === 0)
            return res.status(400).json({ message: 'children array required' });
        if (children.length > 100)
            return res.status(400).json({ message: 'Maximum 100 children per batch' });
        const mentor = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            select: { isMentor: true, mentorType: true, guardianInfo: true }
        });
        if (!mentor?.isMentor)
            return res.status(403).json({ message: 'Only mentor accounts can bulk add children' });
        const gi = mentor.guardianInfo;
        const schoolCode = gi?.institutionName ? getSchoolCode(gi.institutionName) : 'mg';
        const cityCode = gi?.city ? getCityCode(gi.city) : 'in';
        const year = new Date().getFullYear();
        const results = [];
        for (const row of children) {
            const { childName, parentName, parentPhone, grade } = row;
            if (!childName?.trim())
                continue;
            const firstName = childName.trim().split(' ')[0].toLowerCase();
            const parentInitial = (parentName?.trim()?.[0] ?? 'x').toLowerCase();
            const baseEmail = `${firstName}${parentInitial}.${schoolCode}.${cityCode}@miniguru.in`;
            let email = baseEmail;
            let counter = 2;
            while (await prismaClient_1.default.user.findUnique({ where: { email } })) {
                email = `${firstName}${parentInitial}${counter}.${schoolCode}.${cityCode}@miniguru.in`;
                counter++;
            }
            const displayFirst = childName.trim().split(' ')[0];
            const password = `${displayFirst}@${year}`;
            const pin = parentPhone
                ? String(parentPhone).replace(/\D/g, '').slice(-4).padStart(4, '1')
                : '1234';
            const passwordHash = await bcryptjs_1.default.hash(password, 10);
            const pinHash = await bcryptjs_1.default.hash(pin, 10);
            const linkedUser = await prismaClient_1.default.user.create({
                data: {
                    email, passwordHash,
                    name: childName.trim(),
                    age: 10,
                    phoneNumber: `child_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    role: 'USER', score: 100, isMentor: false,
                }
            });
            await prismaClient_1.default.childProfile.create({
                data: {
                    guardianId: userId,
                    name: childName.trim(),
                    age: 10,
                    grade: grade ?? null,
                    pinHash,
                    linkedUserId: linkedUser.id,
                }
            });
            results.push({
                childName: childName.trim(),
                parentName: parentName ?? '',
                grade: grade ?? '',
                loginEmail: email,
                password,
                pin,
            });
        }
        return res.status(201).json({ message: `${results.length} children added`, results });
    }
    catch (err) {
        console.error('bulk add error:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
});
// ─── POST /mentor/send-credentials ───────────────────────────────────────────
router.post('/send-credentials', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { results } = req.body;
        if (!Array.isArray(results) || results.length === 0)
            return res.status(400).json({ message: 'results array required' });
        const teacher = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
        });
        if (!teacher)
            return res.status(404).json({ message: 'Teacher not found' });
        const rows = results.map((r) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #E8EAFF;">${r.childName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E8EAFF;font-family:monospace;color:#5B6EF5;">${r.loginEmail}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E8EAFF;color:#10B981;font-weight:700;">${r.password}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E8EAFF;color:#E8A000;font-weight:900;">${r.pin}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E8EAFF;">${r.grade || "—"}</td>
      </tr>`).join("");
        const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#F5F7FF;padding:20px;">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#5B6EF5,#8B9FF8);padding:28px;text-align:center;">
<h1 style="color:#fff;margin:8px 0;">${results.length} Student Credentials</h1>
<p style="color:rgba(255,255,255,0.8);margin:0;">MiniGuru School Registration</p></div>
<div style="padding:24px;">
<p style="color:#3D3D5C;">Hi ${teacher.name},<br><br>Share each student their MiniGuru ID + Password. Keep the PIN — it lets you view any student's activities.</p>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<thead><tr style="background:#F0F4FF;">
<th style="padding:10px;text-align:left;color:#8888AA;font-size:11px;">Name</th>
<th style="padding:10px;text-align:left;color:#8888AA;font-size:11px;">MiniGuru ID</th>
<th style="padding:10px;text-align:left;color:#8888AA;font-size:11px;">Password</th>
<th style="padding:10px;text-align:left;color:#8888AA;font-size:11px;">Your PIN</th>
<th style="padding:10px;text-align:left;color:#8888AA;font-size:11px;">Grade</th>
</tr></thead><tbody>${rows}</tbody></table>
<div style="margin-top:20px;padding:14px;background:#FFF8E1;border-radius:10px;border-left:4px solid #E8A000;">
<strong>📌 Students login at miniguru.in with their ID + Password. They can change password after first login.</strong>
</div></div></div></body></html>`;
        const sgMail = require("@sendgrid/mail");
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        await sgMail.send({
            to: teacher.email,
            from: process.env.FROM_EMAIL || "connect@miniguru.in",
            subject: `MiniGuru: ${results.length} Student Credentials`,
            html,
        });
        return res.json({ success: true, message: `Sent to ${teacher.email}` });
    }
    catch (err) {
        console.error("send-credentials error:", err);
        return res.status(500).json({ message: "Failed to send email", error: err.message });
    }
});
exports.default = router;
