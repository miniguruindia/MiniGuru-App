"use strict";
// backend/src/services/emailService.ts
// Replaces SMTP nodemailer with SendGrid HTTP API — works on Cloud Run
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
async function sendEmail({ to, subject, html, }) {
    await sgMail.send({
        to,
        from: {
            email: process.env.FROM_EMAIL || 'connect@miniguru.in',
            name: 'MiniGuru',
        },
        subject,
        html,
    });
}
