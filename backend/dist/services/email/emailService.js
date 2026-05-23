"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.initializeEmailService = initializeEmailService;
const mail_1 = __importDefault(require("@sendgrid/mail"));
mail_1.default.setApiKey(process.env.SENDGRID_API_KEY || '');
const FROM = { email: process.env.FROM_EMAIL || 'connect@miniguru.in', name: 'MiniGuru' };
async function sendEmail({ to, subject, html }) {
    await mail_1.default.send({ to, from: FROM, subject, html });
}
async function sendPasswordResetEmail(to, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await sendEmail({
        to,
        subject: 'Reset your MiniGuru password',
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#F5F7FF;border-radius:16px;">
      <h1 style="color:#5B6EF5;text-align:center">MiniGuru</h1>
      <h2>Reset your password</h2>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetUrl}" style="background:#5B6EF5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
      </div>
      <p style="color:#888;font-size:13px">If you did not request this, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #E8EAF6;margin:24px 0"/>
      <p style="color:#aaa;font-size:12px;text-align:center">MiniGuru Innovation Pvt Ltd, Ujjain MP</p>
    </div>`,
    });
}
async function initializeEmailService() {
    if (!process.env.SENDGRID_API_KEY) {
        console.log('⚠️  Email service error: SENDGRID_API_KEY not set');
        return;
    }
    console.log('✅ Email service ready');
}
exports.default = { sendEmail, sendPasswordResetEmail, initializeEmailService };
