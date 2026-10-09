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
// NOTE ON PHONE (Oct 2026): verifying the CURRENT phone number now works
// through a swappable provider (services/phoneVerification) — Firebase Phone
// Auth today, MSG91 pluggable later. Until the provider is configured the
// endpoint answers a clear 501 and nothing pretends to text a code.
// Changing an already-VERIFIED phone number still goes through "pending
// admin approval" (there is no old-phone OTP step) — unchanged.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectContactChange = exports.approveContactChange = exports.getPendingContactChangeRequests = exports.confirmContactChangeOtp = exports.requestContactChange = exports.confirmVerificationOtp = exports.confirmPhoneProof = exports.sendVerificationOtp = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const emailService_1 = require("../../services/emailService");
const logger_1 = __importDefault(require("../../logger"));
const phoneVerification_1 = require("../../services/phoneVerification");
const costTracking_1 = require("../../utils/costTracking");
const OTP_EXPIRY_MINUTES = 15;
// A MiniGuru login ID is always issued on the @miniguru.in domain — for
// children (firstname.lastname@, or the school-bulk firstnameP.code.city@
// format) AND for admin-created School/T-LAB accounts (institutionname@ or
// firstword.city@). None of these are real inboxes anyone can read.
// Self-registered Parent/School accounts are the one case where user.email
// IS a real personal address, typed by the person at signup — those never
// end in @miniguru.in. This distinguishes the two so "change email" targets
// the right field: user.email for a genuinely real address, guardianEmail
// (the same field already used for a child's real contact) for anyone
// whose login is a generated ID, mentor or not.
function isGeneratedLoginId(email) {
    return !!email && email.trim().toLowerCase().endsWith('@miniguru.in');
}
// True only for a mentor whose OWN email field is a real personal inbox —
// i.e. self-registered, not admin-created with a generated ID.
function mentorHasRealEmailLogin(user) {
    return user.isMentor && !isGeneratedLoginId(user.email);
}
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function otpExpiry() {
    return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}
async function sendOtpEmail(to, purpose, otp) {
    await (0, emailService_1.sendEmail)({
        to,
        cc: 'miniguru.in@gmail.com',
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
        // Prefer guardianEmail (the real inbox for @miniguru.in child accounts,
        // and for admin-created School/T-LAB accounts on a generated login ID)
        // — falls back to the account email itself only for parent/school
        // accounts that self-registered with a real personal address.
        const destination = user.guardianEmail || user.email;
        if (!destination || !destination.includes('@') || isGeneratedLoginId(destination)) {
            return res.status(400).json({
                error: destination && isGeneratedLoginId(destination)
                    ? 'Your login ID is not a real email address, so we can\'t send a code there. Tap "Change" to add a real contact email first.'
                    : 'No real email address on file to send a code to. Add a contact email first.',
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
        // BUGFIX (Aug 2026): this call used to be unguarded — if SendGrid ever
        // threw (bad/expired API key, rejected sender, network error), the
        // request never sent a response at all. The Flutter card's button
        // stays disabled ("faded") forever waiting on a promise that never
        // resolves, and — since the email genuinely never sent — no code ever
        // arrives either. Both halves of the reported bug traced to this one
        // missing try/catch. Now surfaces the real SendGrid error instead of
        // hanging silently.
        try {
            await sendOtpEmail(destination, 'Use this to verify your MiniGuru email address.', otp);
        }
        catch (emailError) {
            logger_1.default.error({ emailError: emailError?.response?.body || emailError?.message || emailError }, '⚠️ sendOtpEmail failed (verification send-otp)');
            return res.status(502).json({
                error: 'Could not send the verification email right now. Please try again in a moment, ' +
                    'or contact connect@miniguru.in if this keeps happening.',
            });
        }
        return res.status(200).json({ message: `Verification code sent.`, maskedTarget: maskEmail(destination) });
    }
    // target === 'phone'
    if (user.phoneVerified) {
        return res.status(400).json({ error: 'Phone number is already verified.' });
    }
    if (!user.phoneNumber) {
        return res.status(400).json({ error: 'No phone number on file. Tap "Change" to add one first.' });
    }
    const phone = (0, phoneVerification_1.normalizePhone)(user.phoneNumber);
    if (!phone) {
        return res.status(400).json({
            error: 'That phone number does not look right. Tap "Change" and enter it like +91XXXXXXXXXX.',
        });
    }
    const provider = (0, phoneVerification_1.getPhoneProvider)();
    if (!provider.isConfigured()) {
        return res.status(501).json({
            error: 'Phone verification is being set up and is not switched on yet. ' +
                'Please verify your email for now, or contact connect@miniguru.in.',
        });
    }
    const quota = await (0, costTracking_1.checkPhoneSmsQuota)(userId);
    if (!quota.allowed) {
        return res.status(429).json({
            error: quota.reason === 'user'
                ? 'You have asked for too many codes today. Please try again tomorrow.'
                : 'Phone verification is very busy today. Please try again tomorrow, or verify your email instead.',
        });
    }
    if (provider.mode === 'client') {
        // The browser sends the SMS itself through the provider's SDK; we only
        // hand it the public settings and the number, then check the proof later
        // (POST /auth/verification/confirm-phone).
        await (0, costTracking_1.recordPhoneSmsStarted)(userId);
        return res.status(200).json({
            clientFlow: true,
            provider: provider.name,
            phone,
            maskedTarget: (0, phoneVerification_1.maskPhone)(phone),
            firebaseConfig: provider.clientConfig(),
        });
    }
    // Server-mode provider (MSG91, later): we send, then confirm-otp checks.
    try {
        await (0, costTracking_1.recordPhoneSmsStarted)(userId);
        await provider.sendOtp(phone);
    }
    catch (smsError) {
        logger_1.default.error({ smsError: smsError?.message || smsError }, '⚠️ phone provider sendOtp failed');
        return res.status(502).json({
            error: 'Could not send the text message right now. Please try again in a moment, or contact connect@miniguru.in.',
        });
    }
    await prismaClient_1.default.user.update({
        where: { id: userId },
        data: { verificationOtpHash: null, verificationOtpExpiry: otpExpiry(), verificationOtpTarget: 'phone' },
    });
    return res.status(200).json({ clientFlow: false, provider: provider.name, maskedTarget: (0, phoneVerification_1.maskPhone)(phone) });
};
exports.sendVerificationOtp = sendVerificationOtp;
// POST /auth/verification/confirm-phone   body: { idToken }
// Client-mode providers (Firebase): the browser already checked the SMS code
// and holds a signed proof. We verify the proof server-side and require the
// number inside it to be exactly the number on this account.
const confirmPhoneProof = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string')
        return res.status(400).json({ error: 'idToken is required' });
    const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (user.phoneVerified)
        return res.status(400).json({ error: 'Phone number is already verified.' });
    const phone = (0, phoneVerification_1.normalizePhone)(user.phoneNumber);
    if (!phone)
        return res.status(400).json({ error: 'No valid phone number on file to verify.' });
    const provider = (0, phoneVerification_1.getPhoneProvider)();
    if (provider.mode !== 'client' || !provider.isConfigured()) {
        return res.status(501).json({ error: 'Phone verification is not switched on yet.' });
    }
    let ok = false;
    try {
        ok = await provider.verifyClientProof(phone, idToken);
    }
    catch (proofError) {
        logger_1.default.warn({ proofError: proofError?.message || proofError }, 'phone proof rejected');
    }
    if (!ok) {
        return res.status(400).json({
            error: 'We could not confirm that phone check. Make sure the number on your account is the one that got the code, then try again.',
        });
    }
    await prismaClient_1.default.user.update({
        where: { id: userId },
        data: { phoneVerified: true, verificationOtpHash: null, verificationOtpExpiry: null, verificationOtpTarget: null },
    });
    await (0, costTracking_1.recordPhoneVerified)();
    return res.status(200).json({ message: 'Phone number verified.', target: 'phone' });
};
exports.confirmPhoneProof = confirmPhoneProof;
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
    // Server-mode phone provider (MSG91, later): the provider holds the code,
    // so there is no local hash to compare — ask the provider instead.
    if (user.verificationOtpTarget === 'phone' && (0, phoneVerification_1.getPhoneProvider)().mode === 'server') {
        if (!user.verificationOtpExpiry || user.verificationOtpExpiry < new Date()) {
            return res.status(400).json({ error: 'That code has expired. Request a new one.' });
        }
        const phone = (0, phoneVerification_1.normalizePhone)(user.phoneNumber);
        let good = false;
        try {
            good = !!phone && (await (0, phoneVerification_1.getPhoneProvider)().verifyOtp(phone, otp.toString().trim()));
        }
        catch (verifyError) {
            logger_1.default.error({ verifyError: verifyError?.message || verifyError }, '⚠️ phone provider verifyOtp failed');
            return res.status(502).json({ error: 'Could not check the code right now. Please try again.' });
        }
        if (!good)
            return res.status(400).json({ error: 'Incorrect code.' });
        await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { phoneVerified: true, verificationOtpHash: null, verificationOtpExpiry: null, verificationOtpTarget: null },
        });
        await (0, costTracking_1.recordPhoneVerified)();
        return res.status(200).json({ message: 'Verified successfully.', target: 'phone' });
    }
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
        // BUGFIX (Aug 2026): for a SELF-REGISTERED mentor/teacher, the real
        // contact email IS their login email (user.email) — no fake ID involved.
        // BUGFIX (this session): that first fix was too broad — it also caught
        // admin-created School/T-LAB accounts, whose login is always a generated
        // xxx@miniguru.in ID, not a real inbox. For those, "change email" must
        // target guardianEmail (same field already used for a child's real
        // contact) instead of overwriting the login ID itself.
        if (target === 'email' && mentorHasRealEmailLogin(user)) {
            try {
                await prismaClient_1.default.user.update({ where: { id: userId }, data: { email: newValue.trim() } });
            }
            catch (e) {
                if (e?.code === 'P2002') {
                    return res.status(409).json({ error: 'That email is already in use by another account.' });
                }
                throw e;
            }
            return res.status(200).json({
                message: `Email updated. It's still unverified — you can verify it any time.`,
                applied: true,
            });
        }
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
        // BUGFIX (Aug 2026): same missing try/catch as sendVerificationOtp above
        // — an unhandled SendGrid failure here left the request hanging with no
        // response, and the email genuinely never sent either.
        try {
            await sendOtpEmail(oldContact, `Someone requested to change the email on this MiniGuru account to ${newValue.trim()}. ` +
                `If this was you, enter this code in the app to confirm. If it wasn't you, ignore this email — no change will happen.`, otp);
        }
        catch (emailError) {
            logger_1.default.error({ emailError: emailError?.response?.body || emailError?.message || emailError }, '⚠️ sendOtpEmail failed (contact change confirmation)');
            return res.status(502).json({
                error: 'Could not send the confirmation email right now. Please try again in a moment, ' +
                    'or contact connect@miniguru.in if this keeps happening.',
            });
        }
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
    // BUGFIX: only a mentor with a REAL email login (self-registered) writes
    // to user.email — see mentorHasRealEmailLogin() and the matching fix in
    // requestContactChange above. Admin-created generated-ID accounts use
    // guardianEmail, same as children.
    if (mentorHasRealEmailLogin(user)) {
        try {
            await prismaClient_1.default.user.update({
                where: { id: userId },
                data: {
                    email: user.pendingEmail,
                    emailVerified: false,
                    pendingEmail: null,
                    verificationOtpHash: null,
                    verificationOtpExpiry: null,
                    verificationOtpTarget: null,
                    contactChangeApprovalFor: null,
                    contactChangeRequestedAt: null,
                },
            });
        }
        catch (e) {
            if (e?.code === 'P2002') {
                return res.status(409).json({ error: 'That email is already in use by another account.' });
            }
            throw e;
        }
        return res.status(200).json({ message: 'Email changed successfully. Verify it whenever you like.' });
    }
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
        // BUGFIX: same mentorHasRealEmailLogin() split as the other two write paths.
        if (mentorHasRealEmailLogin(user)) {
            data.email = user.pendingEmail;
        }
        else {
            data.guardianEmail = user.pendingEmail;
        }
        data.emailVerified = false;
        data.pendingEmail = null;
    }
    if (user.contactChangeApprovalFor === 'phone' && user.pendingPhone) {
        data.phoneNumber = user.pendingPhone;
        data.phoneVerified = false;
        data.pendingPhone = null;
    }
    try {
        await prismaClient_1.default.user.update({ where: { id: userId }, data });
    }
    catch (e) {
        if (e?.code === 'P2002') {
            return res.status(409).json({ error: 'That email is already in use by another account.' });
        }
        throw e;
    }
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
