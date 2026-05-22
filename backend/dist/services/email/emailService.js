"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.initializeEmailService = initializeEmailService;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const mail_1 = __importDefault(require("@sendgrid/mail"));
mail_1.default.setApiKey(process.env.SENDGRID_API_KEY || '');
async function sendEmail({ to, subject, html }) {
    await mail_1.default.send({
        to,
        from: { email: process.env.FROM_EMAIL || 'connect@miniguru.in', name: 'MiniGuru' },
        subject,
        html,
    });
}
async function initializeEmailService() {
    if (!process.env.SENDGRID_API_KEY) {
        console.log('⚠️  Email service error: SENDGRID_API_KEY not set');
        return;
    }
    console.log('✅ Email service ready');
}
exports.default = { sendEmail, initializeEmailService };
async function sendPasswordResetEmail(to, resetUrl) {
    await sendEmail({
        to,
        subject: 'Reset your MiniGuru password',
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#F5F7FF;border-radius:16px;">
      <h1 style="color:#5B6EF5">MiniGuru</h1>
      <h2>Reset your password</h2>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="display:inline-block;background:#5B6EF5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
      <p style="color:#888;font-size:13px;margin-top:24px;">If you didn't request this, ignore this email.</p>
    </div>`,
    });
}
