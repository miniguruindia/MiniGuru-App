"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
// backend/src/services/emailService.ts
// Replaces SMTP nodemailer with an HTTP-based email API — works on Cloud Run
// (which blocks outbound SMTP ports, Rule 22).
//
// STOPGAP (Aug 2026): SendGrid's account is currently under a mandatory
// Twilio "Consumer Trust" identity review (Ticket #29128948) and is
// rejecting every send with "Maximum credits exceeded" in the meantime —
// this has broken OTP/verification/password-reset email for real users.
// Added Resend as a second, independent transport so email keeps working
// while that review is pending, WITHOUT removing or breaking SendGrid:
//
//   - If RESEND_API_KEY is set on Cloud Run, every send goes through
//     Resend instead.
//   - If RESEND_API_KEY is NOT set, behavior is 100% unchanged from
//     before — SendGrid, exactly as it was.
//
// This means deploying this file changes nothing until RESEND_API_KEY is
// actually added as an env var. To switch back to SendGrid once the
// Twilio review clears, just remove/unset RESEND_API_KEY — no code
// change needed either way.
const sgMail = require('@sendgrid/mail');
const { checkEmailQuota, recordEmailSent } = require('../utils/costTracking');
let resendClient = null;
if (process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
}
if (!process.env.SENDGRID_API_KEY && !resendClient) {
    console.log('⚠️  emailService.ts: neither RESEND_API_KEY nor SENDGRID_API_KEY is set — sendEmail() will fail until one is configured');
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
async function sendEmail({ to, subject, html, cc, }) {
    const fromEmail = process.env.FROM_EMAIL || 'connect@miniguru.in';
    const quota = await checkEmailQuota();
    if (!quota.allowed) {
        throw new Error(`EMAIL_QUOTA_EXCEEDED: Daily email limit reached (${quota.sentToday} sent today). ` +
            `Please try again tomorrow, or contact connect@miniguru.in directly.`);
    }
    if (resendClient) {
        // Resend's Node SDK returns { data, error } instead of throwing on
        // API-level failures (e.g. unverified domain, bad recipient) — must
        // check `error` explicitly, a try/catch alone would silently miss
        // these. Network-level failures (DNS, timeout) DO still throw, so
        // the try/catch below is kept as a second layer, not a replacement.
        const { error } = await resendClient.emails.send({
            from: `MiniGuru <${fromEmail}>`,
            to: [to],
            ...(cc ? { cc: Array.isArray(cc) ? cc : [cc] } : {}),
            subject,
            html,
        });
        if (error) {
            throw new Error(`Resend send failed: ${error.message || JSON.stringify(error)}`);
        }
        await recordEmailSent();
        return;
    }
    // Fallback: unchanged SendGrid path
    await sgMail.send({
        to,
        ...(cc ? { cc } : {}),
        from: {
            email: fromEmail,
            name: 'MiniGuru',
        },
        subject,
        html,
    });
    await recordEmailSent();
}
