"use strict";
// backend/src/controllers/auth/contactVerificationController.ts
//
// Contact verification (email + phone) is ALWAYS optional and on-demand —
// never required at registration. An unverified contact just displays as
// "Unverified" in the app; the account holder can request verification any
// time.
//
// Changing a contact works differently depending on its current state:
//   - UNVERIFIED contact → change applies immediately (nothing to protect).
//   - VERIFIED contact   → change requires approval: an OTP is sent to the
//     OLD verified contact to confirm it's really them. If the old contact
//     is unreachable (lost phone, old email dead), the request instead sits
//     as "pending admin approval" — an admin can manually approve it from
//     the admin panel, or the person can contact MiniGuru support directly.
//
// NOTE ON PHONE: there is no SMS provider wired into MiniGuru yet (no
// Twilio/etc — email uses the existing free-tier SendGrid setup). Phone
// verification and phone-change-via-OTP are therefore not yet actually
// deliverable — the endpoints below handle phone requests by routing
// straight to "pending admin approval" until an SMS provider is added.
// This is flagged clearly in every phone-related response so nothing here
// silently pretends to text an OTP that was never sent.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectContactChange = exports.approveContactChange = exports.getPendingContactChangeRequests = exports.confirmContactChangeOtp = exports.requestContactChange = exports.confirmVerificationOtp = exports.sendVerificationOtp = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const emailService_1 = require("../../services/emailService");
const OTP_EXPIRY_MINUTES = 15;
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function otpExpiry() {
    return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}
async function sendOtpEmail(to, purpose, otp) {
    await (0, emailService_1.sendEmail)({
        to,
        subject: `MiniGuru: your verification code`,
        html: `
      <p>Your MiniGuru verification code is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
      <p>${purpose}</p>
      <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you didn't request this, you can safely ignore this email.</p>
    `,
    });
}
// POST /auth/verification/send-otp   body: { target: 'email' | 'phone' }
// Sends an OTP to verify the CURRENT contact (not a change — just proving
// the account holder owns what's already on file).
const sendVerificationOtp = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { target } = req.body;
    if (target !== 'email' && target !== 'phone') {
        return res.status(400).json({ error: "target must be 'email' or 'phone'" });
    }
    const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (target === 'email') {
        if (user.emailVerified) {
            return res.status(400).json({ error: 'Email is already verified.' });
        }
        // Prefer guardianEmail (the real inbox for @miniguru.in child accounts)
        // — falls back to the account email itself for parent/school accounts
        // that registered with a real address.
        const destination = user.guardianEmail || user.email;
        if (!destination || !destination.includes('@')) {
            return res.status(400).json({
                error: 'No real email address on file to send a code to. Add a guardian/contact email first.',
            });
        }
        const otp = generateOtp();
        await prismaClient_1.default.user.update({
            where: { id: userId },
            data: {
                verificationOtpHash: await bcryptjs_1.default.hash(otp, 10),
                verificationOtpExpiry: otpExpiry(),
                verificationOtpTarget: 'email',
            },
        });
        await sendOtpEmail(destination, 'Use this to verify your MiniGuru email address.', otp);
        return res.status(200).json({ message: `Verification code sent.`, maskedTarget: maskEmail(destination) });
    }
    // target === 'phone'
    return res.status(501).json({
        error: 'Phone verification is not available yet — MiniGuru does not currently send SMS. ' +
            'Please verify your email instead, or contact connect@miniguru.in.',
    });
};
exports.sendVerificationOtp = sendVerificationOtp;
// POST /auth/verification/confirm-otp   body: { otp }
// Confirms the OTP sent by sendVerificationOtp above and marks the CURRENT
// contact as verified. (This is not for contact changes — see confirm-change-otp.)
const confirmVerificationOtp = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { otp } = req.body;
    if (!otp)
        return res.status(400).json({ error: 'otp is required' });
    const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (!user.verificationOtpHash || !user.verificationOtpExpiry || !user.verificationOtpTarget) {
        return res.status(400).json({ error: 'No verification code was requested, or it already expired. Request a new one.' });
    }
    if (user.verificationOtpExpiry < new Date()) {
        return res.status(400).json({ error: 'That code has expired. Request a new one.' });
    }
    const valid = await bcryptjs_1.default.compare(otp.toString().trim(), user.verificationOtpHash);
    if (!valid)
        return res.status(400).json({ error: 'Incorrect code.' });
    const data = {
        verificationOtpHash: null,
        verificationOtpExpiry: null,
        verificationOtpTarget: null,
    };
    if (user.verificationOtpTarget === 'email')
        data.emailVerified = true;
    if (user.verificationOtpTarget === 'phone')
        data.phoneVerified = true;
    await prismaClient_1.default.user.update({ where: { id: userId }, data });
    return res.status(200).json({ message: 'Verified successfully.', target: user.verificationOtpTarget });
};
exports.confirmVerificationOtp = confirmVerificationOtp;
// POST /auth/verification/request-change
//   body: { target: 'email' | 'phone', newValue: string }
const requestContactChange = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { target, newValue } = req.body;
    if (target !== 'email' && target !== 'phone') {
        return res.status(400).json({ error: "target must be 'email' or 'phone'" });
    }
    if (!newValue || !newValue.trim()) {
        return res.status(400).json({ error: 'newValue is required' });
    }
    const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const isCurrentlyVerified = target === 'email' ? user.emailVerified : user.phoneVerified;
    const oldContact = target === 'email' ? (user.guardianEmail || user.email) : user.phoneNumber;
    // ── Case 1: contact is NOT verified — apply immediately, nothing to protect ──
    if (!isCurrentlyVerified) {
        const data = target === 'email' ? { guardianEmail: newValue.trim() } : { phoneNumber: newValue.trim() };
        await prismaClient_1.default.user.update({ where: { id: userId }, data });
        return res.status(200).json({
            message: `${target === 'email' ? 'Email' : 'Phone'} updated. It's still unverified — you can verify it any time.`,
            applied: true,
        });
    }
    // ── Case 2: contact IS verified — needs approval ──────────────────────────
    // Email: we CAN send an OTP to the old verified address to confirm.
    if (target === 'email' && oldContact && oldContact.includes('@')) {
        const otp = generateOtp();
        await prismaClient_1.default.user.update({
            where: { id: userId },
            data: {
                pendingEmail: newValue.trim(),
                verificationOtpHash: await bcryptjs_1.default.hash(otp, 10),
                verificationOtpExpiry: otpExpiry(),
                verificationOtpTarget: 'email',
                contactChangeApprovalFor: null,
                contactChangeRequestedAt: new Date(),
            },
        });
        await sendOtpEmail(oldContact, `Someone requested to change the email on this MiniGuru account to ${newValue.trim()}. ` +
            `If this was you, enter this code in the app to confirm. If it wasn't you, ignore this email — no change will happen.`, otp);
        return res.status(200).json({
            message: `A confirmation code was sent to your current verified email. Enter it to complete the change.`,
            maskedTarget: maskEmail(oldContact),
            requiresOtpConfirm: true,
        });
    }
    // Phone (verified) or email with no reachable old contact — no SMS
    // provider exists yet, so this can only go to manual admin approval.
    await prismaClient_1.default.user.update({
        where: { id: userId },
        data: {
            [target === 'email' ? 'pendingEmail' : 'pendingPhone']: newValue.trim(),
            contactChangeApprovalFor: target,
            contactChangeRequestedAt: new Date(),
        },
    });
    return res.status(200).json({
        message: `Your old ${target} can't be used to confirm this automatically. ` +
            `This request now needs manual approval — an admin will review it, or you can contact connect@miniguru.in directly.`,
        requiresAdminApproval: true,
    });
};
exports.requestContactChange = requestContactChange;
// POST /auth/verification/confirm-change-otp   body: { otp }
const confirmContactChangeOtp = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { otp } = req.body;
    if (!otp)
        return res.status(400).json({ error: 'otp is required' });
    const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (!user.verificationOtpHash || !user.verificationOtpExpiry || !user.verificationOtpTarget || !user.pendingEmail) {
        return res.status(400).json({ error: 'No pending contact change found, or it already expired.' });
    }
    if (user.verificationOtpExpiry < new Date()) {
        return res.status(400).json({ error: 'That code has expired. Request the change again.' });
    }
    const valid = await bcryptjs_1.default.compare(otp.toString().trim(), user.verificationOtpHash);
    if (!valid)
        return res.status(400).json({ error: 'Incorrect code.' });
    // Apply the change — new contact starts UNVERIFIED again (must be
    // re-verified independently; confirming via the OLD contact only proves
    // the change request was legitimate, not that the NEW contact is real).
    await prismaClient_1.default.user.update({
        where: { id: userId },
        data: {
            guardianEmail: user.pendingEmail,
            emailVerified: false,
            pendingEmail: null,
            verificationOtpHash: null,
            verificationOtpExpiry: null,
            verificationOtpTarget: null,
            contactChangeApprovalFor: null,
            contactChangeRequestedAt: null,
        },
    });
    return res.status(200).json({ message: 'Email changed successfully. Verify it whenever you like.' });
};
exports.confirmContactChangeOtp = confirmContactChangeOtp;
// ── Admin-side manual approval (for the "old contact unreachable" path) ────
// GET /admin/contact-change-requests
const getPendingContactChangeRequests = async (_req, res) => {
    const users = await prismaClient_1.default.user.findMany({
        where: { contactChangeApprovalFor: { not: null } },
        select: {
            id: true, name: true, email: true, guardianEmail: true, phoneNumber: true,
            pendingEmail: true, pendingPhone: true, contactChangeApprovalFor: true, contactChangeRequestedAt: true,
        },
    });
    return res.status(200).json({ requests: users });
};
exports.getPendingContactChangeRequests = getPendingContactChangeRequests;
// POST /admin/contact-change-requests/:userId/approve
const approveContactChange = async (req, res) => {
    const { userId } = req.params;
    const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!user || !user.contactChangeApprovalFor) {
        return res.status(404).json({ error: 'No pending contact-change request for this user.' });
    }
    const data = { contactChangeApprovalFor: null, contactChangeRequestedAt: null };
    if (user.contactChangeApprovalFor === 'email' && user.pendingEmail) {
        data.guardianEmail = user.pendingEmail;
        data.emailVerified = false;
        data.pendingEmail = null;
    }
    if (user.contactChangeApprovalFor === 'phone' && user.pendingPhone) {
        data.phoneNumber = user.pendingPhone;
        data.phoneVerified = false;
        data.pendingPhone = null;
    }
    await prismaClient_1.default.user.update({ where: { id: userId }, data });
    return res.status(200).json({ message: 'Contact change approved and applied.' });
};
exports.approveContactChange = approveContactChange;
// POST /admin/contact-change-requests/:userId/reject
const rejectContactChange = async (req, res) => {
    const { userId } = req.params;
    await prismaClient_1.default.user.update({
        where: { id: userId },
        data: {
            contactChangeApprovalFor: null,
            contactChangeRequestedAt: null,
            pendingEmail: null,
            pendingPhone: null,
        },
    });
    return res.status(200).json({ message: 'Contact change request rejected.' });
};
exports.rejectContactChange = rejectContactChange;
function maskEmail(email) {
    const [local, domain] = email.split('@');
    if (!domain)
        return email;
    if (local.length <= 2)
        return `${local[0]}***@${domain}`;
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}
