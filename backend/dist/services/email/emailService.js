"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.initializeEmailService = initializeEmailService;
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
