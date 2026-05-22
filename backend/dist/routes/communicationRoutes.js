"use strict";
// backend/src/routes/communicationRoutes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const logger_1 = __importDefault(require("../logger"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// ── Email transporter (reuse existing SMTP config) ─────────────────────────
const FROM = `"MiniGuru" <${process.env.FROM_EMAIL}>`;
function htmlWrap(title, body) {
    return `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
    .wrap{max-width:600px;margin:0 auto;padding:20px}
    .header{background:linear-gradient(135deg,#5B6EF5,#764ba2);color:white;padding:28px 30px;border-radius:10px 10px 0 0;text-align:center}
    .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
    .footer{text-align:center;margin-top:20px;color:#999;font-size:12px}
  </style></head><body><div class="wrap">
    <div class="header"><h2 style="margin:0">${title}</h2></div>
    <div class="content">${body}</div>
    <div class="footer">&copy; ${new Date().getFullYear()} MiniGuru India. All rights reserved.<br/>
    <small>You are receiving this because you have a MiniGuru account.</small></div>
  </div></body></html>`;
}
// ── PUBLIC: POST /communication/contact ────────────────────────────────────
// Flutter app / website contact form — no auth needed
router.post('/contact', async (req, res) => {
    try {
        const { name, email, subject, message, source } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ message: 'name, email and message are required' });
        }
        const record = await prismaClient_1.default.contactMessage.create({
            data: { name, email, subject: subject || 'General Enquiry', message, source: source || 'app' }
        });
        // Forward to admin email
        try {
            await transporter.sendMail({
                from: FROM,
                to: process.env.ADMIN_EMAIL,
                replyTo: email,
                subject: `[MiniGuru Inbox] ${subject || 'New message'} — from ${name}`,
                html: htmlWrap('New Message Received', `
          <p><strong>From:</strong> ${name} (${email})</p>
          <p><strong>Subject:</strong> ${subject || 'General Enquiry'}</p>
          <p><strong>Source:</strong> ${source || 'app'}</p>
          <hr/>
          <p>${message.replace(/\n/g, '<br/>')}</p>
        `),
            });
        }
        catch (mailErr) {
            logger_1.default.warn(`Contact form: admin notify failed — ${mailErr.message}`);
        }
        return res.status(201).json({ success: true, id: record.id });
    }
    catch (error) {
        logger_1.default.error(`POST /communication/contact: ${error.message}`);
        return res.status(500).json({ message: 'Failed to submit message' });
    }
});
// ── ADMIN: GET /admin/communication/inbox ──────────────────────────────────
router.get('/inbox', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const messages = await prismaClient_1.default.contactMessage.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return res.json(messages);
    }
    catch (error) {
        return res.status(500).json({ message: 'Failed to fetch inbox' });
    }
});
// ── ADMIN: PUT /admin/communication/inbox/:id ──────────────────────────────
router.put('/inbox/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const { status } = req.body; // unread | read | replied
        const updated = await prismaClient_1.default.contactMessage.update({
            where: { id: req.params.id },
            data: {
                status,
                ...(status === 'replied' ? { repliedAt: new Date(), repliedBy: req.user?.userId } : {})
            }
        });
        return res.json(updated);
    }
    catch (error) {
        return res.status(500).json({ message: 'Failed to update message' });
    }
});
// ── ADMIN: DELETE /admin/communication/inbox/:id ───────────────────────────
router.delete('/inbox/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        await prismaClient_1.default.contactMessage.delete({ where: { id: req.params.id } });
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ message: 'Failed to delete message' });
    }
});
// ── ADMIN: POST /admin/communication/broadcast ─────────────────────────────
// Send email to ALL users
router.post('/broadcast', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const { subject, message, previewText } = req.body;
        if (!subject || !message)
            return res.status(400).json({ message: 'subject and message required' });
        const users = await prismaClient_1.default.user.findMany({ select: { email: true, name: true } });
        if (users.length === 0)
            return res.status(400).json({ message: 'No users found' });
        let sent = 0;
        let failed = 0;
        for (const user of users) {
            try {
                await transporter.sendMail({
                    from: FROM,
                    to: user.email,
                    subject,
                    html: htmlWrap(subject, `
            <p>Hi ${user.name},</p>
            ${message.replace(/\n/g, '<br/>')}
            <br/><br/><p style="color:#999;font-size:12px">${previewText || ''}</p>
          `),
                });
                sent++;
            }
            catch {
                failed++;
            }
        }
        logger_1.default.info(`Broadcast: ${sent} sent, ${failed} failed`);
        return res.json({ success: true, sent, failed, total: users.length });
    }
    catch (error) {
        logger_1.default.error(`Broadcast error: ${error.message}`);
        return res.status(500).json({ message: 'Broadcast failed' });
    }
});
// ── ADMIN: POST /admin/communication/send ──────────────────────────────────
// Send email to a specific user by userId or email
router.post('/send', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const { userId, email: toEmail, subject, message } = req.body;
        if (!subject || !message)
            return res.status(400).json({ message: 'subject and message required' });
        if (!userId && !toEmail)
            return res.status(400).json({ message: 'userId or email required' });
        let recipient = null;
        if (userId) {
            recipient = await prismaClient_1.default.user.findUnique({
                where: { id: userId }, select: { email: true, name: true }
            });
        }
        else {
            recipient = await prismaClient_1.default.user.findUnique({
                where: { email: toEmail }, select: { email: true, name: true }
            });
        }
        if (!recipient)
            return res.status(404).json({ message: 'User not found' });
        await transporter.sendMail({
            from: FROM,
            to: recipient.email,
            subject,
            html: htmlWrap(subject, `
        <p>Hi ${recipient.name},</p>
        ${message.replace(/\n/g, '<br/>')}
      `),
        });
        logger_1.default.info(`Direct email sent to ${recipient.email}`);
        return res.json({ success: true, sentTo: recipient.email });
    }
    catch (error) {
        logger_1.default.error(`Direct send error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to send email' });
    }
});
// ── ADMIN: GET /admin/communication/users ──────────────────────────────────
// For the direct message user picker
router.get('/users', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const users = await prismaClient_1.default.user.findMany({
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        });
        return res.json(users);
    }
    catch (error) {
        return res.status(500).json({ message: 'Failed to fetch users' });
    }
});
// ── ADMIN: POST /admin/communication/announcement ──────────────────────────
// Store an in-app announcement (Flutter reads from /cms/announcements)
router.post('/announcement', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const { title, body, type, expiresAt } = req.body;
        if (!title || !body)
            return res.status(400).json({ message: 'title and body required' });
        const existing = await prismaClient_1.default.siteContent.findUnique({ where: { key: 'announcements' } });
        const list = existing?.value || [];
        list.unshift({
            id: Date.now().toString(),
            title, body,
            type: type || 'info', // info | warning | success | promo
            expiresAt: expiresAt || null,
            createdAt: new Date().toISOString(),
            createdBy: req.user?.userId,
        });
        // Keep last 20 announcements
        const trimmed = list.slice(0, 20);
        await prismaClient_1.default.siteContent.upsert({
            where: { key: 'announcements' },
            update: { value: trimmed },
            create: { key: 'announcements', value: trimmed },
        });
        return res.json({ success: true, total: trimmed.length });
    }
    catch (error) {
        logger_1.default.error(`Announcement error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to save announcement' });
    }
});
// ── ADMIN: DELETE /admin/communication/announcement/:id ────────────────────
router.delete('/announcement/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const existing = await prismaClient_1.default.siteContent.findUnique({ where: { key: 'announcements' } });
        const list = (existing?.value || []).filter((a) => a.id !== req.params.id);
        await prismaClient_1.default.siteContent.upsert({
            where: { key: 'announcements' },
            update: { value: list },
            create: { key: 'announcements', value: list },
        });
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ message: 'Failed to delete announcement' });
    }
});
exports.default = router;
