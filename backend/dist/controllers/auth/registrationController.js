"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.sendOtp = sendOtp;
exports.verifyOtp = verifyOtp;
exports.registerChild = registerChild;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const emailService_1 = require("../../services/emailService");
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const logger_1 = __importDefault(require("../../logger"));
function toIdSegment(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}
async function generateId(req, res) {
    try {
        const { firstName, lastName } = req.body;
        if (!firstName?.trim() || !lastName?.trim()) {
            return res.status(400).json({ error: 'First and last name are required' });
        }
        const base = `${toIdSegment(firstName)}.${toIdSegment(lastName)}`;
        let candidate = `${base}@miniguru.in`;
        let counter = 2;
        while (true) {
            const [inUsers, inPending] = await Promise.all([
                prismaClient_1.default.user.findUnique({ where: { email: candidate } }),
                prismaClient_1.default.pendingRegistration.findUnique({ where: { miniguruId: candidate } }),
            ]);
            if (!inUsers && !inPending)
                break;
            candidate = `${base}${counter}@miniguru.in`;
            counter++;
        }
        return res.json({ miniguruId: candidate, available: true });
    }
    catch (err) {
        logger_1.default.error({ err }, 'generate-id error');
        return res.status(500).json({ error: 'Server error' });
    }
}
async function sendOtp(req, res) {
    try {
        const { firstName, lastName, age, grade, guardianName, guardianEmail, guardianPhone, password, miniguruId } = req.body;
        if (!firstName?.trim() || !lastName?.trim() || !age || !guardianEmail?.trim() || !password || !miniguruId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim())) {
            return res.status(400).json({ error: 'Please enter a valid guardian email' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 4 || ageNum > 18) {
            return res.status(400).json({ error: 'Age must be between 4 and 18' });
        }
        const taken = await prismaClient_1.default.user.findUnique({ where: { email: miniguruId } });
        if (taken) {
            return res.status(409).json({ error: 'This MiniGuru ID was just taken. Please go back and get a new one.' });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcryptjs_1.default.hash(otp, 10);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        await prismaClient_1.default.pendingRegistration.upsert({
            where: { miniguruId },
            create: {
                miniguruId,
                childName: `${firstName.trim()} ${lastName.trim()}`,
                age: ageNum,
                grade: grade?.trim() || null,
                guardianName: guardianName?.trim() || null,
                guardianEmail: guardianEmail.toLowerCase().trim(),
                guardianPhone: guardianPhone?.trim() || null,
                passwordHash,
                otpHash,
                otpExpiry,
            },
            update: { otpHash, otpExpiry, passwordHash },
        });
        await (0, emailService_1.sendEmail)({
            to: guardianEmail.trim(),
            subject: `${otp} — MiniGuru Verification Code for ${firstName.trim()}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#F5F7FF;border-radius:16px;">
        <div style="text-align:center"><div style="font-size:40px">🎓</div><h1 style="color:#5B6EF5">MiniGuru</h1></div>
        <h2 style="color:#1A1A2E">Welcome to MiniGuru! 🎉</h2>
        <p>Hi ${guardianName?.trim() || 'there'},</p>
        <p><strong>${firstName.trim()}</strong>'s MiniGuru login ID will be:</p>
        <div style="background:#E8EAF6;border-radius:10px;padding:12px 16px;margin:16px 0;font-size:16px;font-weight:bold;color:#5B6EF5">${miniguruId}</div>
        <p>Please save this ID — they will use it to log in every time.</p>
        <p>Verification code:</p>
        <div style="text-align:center;margin:24px 0"><span style="font-size:48px;font-weight:900;color:#5B6EF5;letter-spacing:12px">${otp}</span></div>
        <p style="color:#888;font-size:13px">⏱ Expires in 10 minutes.</p>
        <hr style="border:none;border-top:1px solid #E8EAF6;margin:24px 0"/>
        <p style="color:#aaa;font-size:12px;text-align:center">MiniGuru Innovation Pvt Ltd, Ujjain MP · connect@miniguru.in</p>
      </div>`,
        });
        logger_1.default.info({ miniguruId, guardianEmail }, 'OTP sent');
        return res.json({ success: true, message: 'Verification code sent to guardian email' });
    }
    catch (err) {
        // BUGFIX (Aug 2026): the err.code === 'EAUTH' / responseCode === 535
        // checks below are leftover from this project's old nodemailer/SMTP
        // era — this file switched to SendGrid a long time ago, which throws
        // in a completely different shape, so those checks never actually
        // matched anything and every real failure fell through to the same
        // generic "Failed to send OTP" message regardless of cause. Extract
        // whatever SendGrid (or anything else) actually says instead.
        const realReason = err?.response?.body?.errors?.[0]?.message || err?.message || 'unknown error';
        logger_1.default.error({ err: realReason }, 'send-otp error');
        if (err.code === 'EAUTH' || err.responseCode === 535) {
            return res.status(500).json({ error: 'Email service unavailable. Please try again.' });
        }
        return res.status(500).json({ error: `Failed to send OTP: ${realReason}` });
    }
}
async function verifyOtp(req, res) {
    try {
        const { miniguruId, otp } = req.body;
        if (!miniguruId || !otp) {
            return res.status(400).json({ error: 'Missing miniguruId or OTP' });
        }
        const pending = await prismaClient_1.default.pendingRegistration.findUnique({ where: { miniguruId } });
        if (!pending) {
            return res.status(404).json({ error: 'Registration session not found. Please start again.' });
        }
        if (new Date() > pending.otpExpiry) {
            return res.status(400).json({ error: 'Code has expired. Please tap Resend to get a new one.' });
        }
        const valid = await bcryptjs_1.default.compare(otp.toString().trim(), pending.otpHash);
        if (!valid) {
            return res.status(400).json({ error: 'Incorrect code. Please try again.' });
        }
        const user = await prismaClient_1.default.user.create({
            data: {
                email: pending.miniguruId,
                name: pending.childName,
                age: pending.age,
                grade: pending.grade,
                passwordHash: pending.passwordHash,
                phoneNumber: pending.guardianPhone,
                parentName: pending.guardianName,
                parentPhone: pending.guardianPhone,
                guardianEmail: pending.guardianEmail,
                emailVerified: true,
                score: 100,
                role: 'USER',
                wallet: { create: { balance: 0 } },
            },
        });
        await prismaClient_1.default.pendingRegistration.delete({ where: { miniguruId } });
        logger_1.default.info({ userId: user.id, miniguruId }, 'Child account created');
        return res.status(201).json({ success: true, message: 'Account created!', miniguruId: user.email, name: user.name });
    }
    catch (err) {
        logger_1.default.error({ err: err.message }, 'verify-otp error');
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'This MiniGuru ID was just taken. Please start again.' });
        }
        return res.status(500).json({ error: 'Account creation failed. Please try again.' });
    }
}
// ─────────────────────────────────────────────────────────────────────────
// registerChild — Aug 2026: direct, single-step child account creation,
// matching how Parent/School registration already works (POST /mentor/
// register creates the account immediately, no blocking pre-registration
// gate). Founder reported the old blocking sendOtp()/verifyOtp() flow was
// failing with "Failed to send OTP" and asked for the child form to behave
// like the other two: one "Create Account" tap, done.
//
// This does the SAME account-creation work verifyOtp() above does, minus
// the OTP wait — creates the User directly. emailVerified is honestly set
// to false here (unlike verifyOtp's `true`) since nothing has actually
// confirmed the guardian email in this flow; the guardian can still verify
// it later from Profile, same as every other account type. A welcome email
// with the child's login ID is fired to the guardian afterward as
// best-effort/non-blocking — reusing the auto-fire pattern already proven
// for Parent/School registration (guardianRoutes.ts) — so a flaky email
// provider can never block account creation itself, only the notification.
//
// sendOtp()/verifyOtp() above are left in place (not deleted) in case
// anything else still references the OTP endpoints directly; the Flutter
// registration screen no longer calls them for the primary flow.
async function registerChild(req, res) {
    try {
        const { firstName, lastName, age, grade, guardianName, guardianEmail, guardianPhone, password, miniguruId } = req.body;
        if (!firstName?.trim() || !lastName?.trim() || !age || !guardianEmail?.trim() || !password || !miniguruId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim())) {
            return res.status(400).json({ error: 'Please enter a valid guardian email' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 4 || ageNum > 18) {
            return res.status(400).json({ error: 'Age must be between 4 and 18' });
        }
        const taken = await prismaClient_1.default.user.findUnique({ where: { email: miniguruId } });
        if (taken) {
            return res.status(409).json({ error: 'This MiniGuru ID was just taken. Please go back and get a new one.' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await prismaClient_1.default.user.create({
            data: {
                email: miniguruId,
                name: `${firstName.trim()} ${lastName.trim()}`,
                age: ageNum,
                grade: grade?.trim() || null,
                passwordHash,
                phoneNumber: guardianPhone?.trim() || null,
                parentName: guardianName?.trim() || null,
                parentPhone: guardianPhone?.trim() || null,
                guardianEmail: guardianEmail.toLowerCase().trim(),
                emailVerified: false,
                score: 100,
                role: 'USER',
                wallet: { create: { balance: 0 } },
            },
        });
        // Clean up any stale pending-OTP record for this ID from an earlier
        // attempt via the old flow — never blocks account creation either way.
        try {
            await prismaClient_1.default.pendingRegistration.deleteMany({ where: { miniguruId } });
        }
        catch (_) { /* nothing to clean up, fine */ }
        logger_1.default.info({ userId: user.id, miniguruId }, 'Child account created (direct, no OTP gate)');
        // Best-effort welcome email — same info a parent would have seen in the
        // old OTP email, minus the code. A failure here is logged but never
        // changes the response — the account already exists either way.
        try {
            await (0, emailService_1.sendEmail)({
                to: guardianEmail.trim(),
                subject: `Welcome to MiniGuru — ${firstName.trim()}'s account is ready!`,
                html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#F5F7FF;border-radius:16px;">
          <div style="text-align:center"><div style="font-size:40px">🎓</div><h1 style="color:#5B6EF5">MiniGuru</h1></div>
          <h2 style="color:#1A1A2E">Welcome to MiniGuru! 🎉</h2>
          <p>Hi ${guardianName?.trim() || 'there'},</p>
          <p><strong>${firstName.trim()}</strong>'s MiniGuru account is ready. Their login ID is:</p>
          <div style="background:#E8EAF6;border-radius:10px;padding:12px 16px;margin:16px 0;font-size:16px;font-weight:bold;color:#5B6EF5">${miniguruId}</div>
          <p>Please save this ID — they will use it to log in every time.</p>
          <hr style="border:none;border-top:1px solid #E8EAF6;margin:24px 0"/>
          <p style="color:#aaa;font-size:12px;text-align:center">MiniGuru Innovation Pvt Ltd, Ujjain MP · connect@miniguru.in</p>
        </div>`,
            });
        }
        catch (emailErr) {
            logger_1.default.error({ err: emailErr.message, miniguruId }, 'registerChild: welcome email failed (non-blocking)');
        }
        return res.status(201).json({ success: true, message: 'Account created!', miniguruId: user.email, name: user.name });
    }
    catch (err) {
        logger_1.default.error({ err: err.message }, 'register-child error');
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'This MiniGuru ID was just taken. Please go back and get a new one.' });
        }
        return res.status(500).json({ error: 'Account creation failed. Please try again.' });
    }
}
