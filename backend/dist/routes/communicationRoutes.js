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
const emailService_1 = require("../services/email/emailService");
const emailLog_1 = require("../utils/emailLog");
const notificationService_1 = require("../services/notificationService");
const router = express_1.default.Router();
const FROM_EMAIL = process.env.FROM_EMAIL || 'connect@miniguru.in';
function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Plain text from the admin form -> safe HTML with line breaks kept.
function htmlText(s) {
    return escHtml(s).replace(/\r?\n/g, '<br/>');
}
// A MiniGuru login ID (@miniguru.in) cannot receive mail. Children's mail goes
// to the guardian's address; if there is no real inbox at all, skip the email.
function realInbox(u) {
    const to = (u.guardianEmail || u.email || '').trim();
    if (!to || to.toLowerCase().endsWith('@miniguru.in'))
        return null;
    return to;
}
function htmlWrap(title, body, footerNote) {
    return `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
    .wrap{max-width:600px;margin:0 auto;padding:20px}
    .header{background:linear-gradient(135deg,#5B6EF5,#764ba2);color:white;padding:28px 30px;border-radius:10px 10px 0 0;text-align:center}
    .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
    .footer{text-align:center;margin-top:20px;color:#999;font-size:12px}
  </style></head><body><div class="wrap">
    <div class="header"><h2 style="margin:0">${title}</h2></div>
    <div class="content">${body}</div>
    <div class="footer">${footerNote ? `<p style="margin:0 0 8px">${escHtml(footerNote)}</p>` : ''}&copy; ${new Date().getFullYear()} MiniGuru India. All rights reserved.<br/>
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
            await (0, emailService_1.sendEmail)({ to: process.env.ADMIN_EMAIL, subject: `[MiniGuru Inbox] ${subject || 'New message'} — from ${name}`, html: "" });
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
// ── ADMIN: POST /admin/communication/broadcast ──────────────────────────────
// In-app notification to EVERY user by default — no email, no quota risk.
// Pass alsoEmail: true to also send a real email to everyone (previous
// version always emailed everyone AND had a bug where subject/message were
// never actually included in the email body — fixed here too, in case
// alsoEmail is ever used for something genuinely urgent).
router.post('/broadcast', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const { subject, message, alsoEmail, previewText } = req.body;
        if (!subject || !message)
            return res.status(400).json({ message: 'subject and message required' });
        const users = await prismaClient_1.default.user.findMany({ select: { id: true, email: true, name: true, guardianEmail: true } });
        if (users.length === 0)
            return res.status(400).json({ message: 'No users found' });
        await (0, notificationService_1.notifyManyUsers)({
            userIds: users.map((u) => u.id),
            type: 'broadcast',
            emoji: '📣',
            message: `${subject} — ${message}`,
        });
        let sent = 0;
        let failed = 0;
        if (alsoEmail === true) {
            // One email per real inbox (a parent with several children gets one),
            // sent to the guardian's address for children.
            const seen = new Set();
            for (const user of users) {
                const to = realInbox(user);
                if (!to || seen.has(to.toLowerCase()))
                    continue;
                seen.add(to.toLowerCase());
                try {
                    await (0, emailService_1.sendEmail)({ to, subject, html: htmlWrap(subject, `<p>${htmlText(message)}</p>`, previewText), fromOverride: emailService_1.OFFICIAL_FROM, kind: 'announcement', reference: `Announcement: ${String(subject).slice(0, 100)}` });
                    sent++;
                }
                catch {
                    failed++;
                }
            }
        }
        logger_1.default.info(`Broadcast: ${users.length} in-app notifications created` +
            (alsoEmail ? `, ${sent} emailed (${failed} failed)` : ' — no email sent (in-app only)'));
        return res.json({ success: true, notified: users.length, emailed: sent, emailFailed: failed, total: users.length });
    }
    catch (error) {
        logger_1.default.error(`Broadcast error: ${error.message}`);
        return res.status(500).json({ message: 'Broadcast failed' });
    }
});
// ── ADMIN: POST /admin/communication/send ──────────────────────────────────
// In-app notification to one user by default. Pass alsoEmail: true to also
// send a real email (e.g. reaching someone who doesn't check the app often).
router.post('/send', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const { userId, email: toEmail, subject, message, alsoEmail, previewText } = req.body;
        if (!subject || !message)
            return res.status(400).json({ message: 'subject and message required' });
        if (!userId && !toEmail)
            return res.status(400).json({ message: 'userId or email required' });
        let recipient = null;
        if (userId) {
            recipient = await prismaClient_1.default.user.findUnique({
                where: { id: userId }, select: { id: true, email: true, name: true, guardianEmail: true }
            });
        }
        else {
            recipient = await prismaClient_1.default.user.findUnique({
                where: { email: toEmail }, select: { id: true, email: true, name: true, guardianEmail: true }
            });
        }
        if (!recipient)
            return res.status(404).json({ message: 'User not found' });
        await (0, notificationService_1.notifyUser)({
            userId: recipient.id,
            type: 'direct',
            emoji: '✉️',
            message: `${subject} — ${message}`,
        });
        let emailed = false;
        let emailNote;
        if (alsoEmail === true) {
            const to = realInbox(recipient);
            if (to) {
                await (0, emailService_1.sendEmail)({ to, subject, html: htmlWrap(subject, `<p>${htmlText(message)}</p>`, previewText), fromOverride: emailService_1.OFFICIAL_FROM, kind: 'direct', reference: `Message to ${String(recipient.name || '').slice(0, 40)}: ${String(subject).slice(0, 80)}` });
                emailed = true;
            }
            else {
                emailNote = 'In-app message sent. No real email address on file for this person, so no email was sent.';
            }
        }
        logger_1.default.info(`Direct message sent to ${recipient.email} (in-app${emailed ? ' + email' : ' only'})`);
        return res.json({ success: true, sentTo: recipient.email, emailed, emailNote });
    }
    catch (error) {
        logger_1.default.error(`Direct send error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to send message' });
    }
});
// ── ADMIN: Sent emails (stored copy, Save / Forward / Delete, contacts) ───────
// GET    /admin/communication/emails?view=all|fresh|expiring|saved&q=
// GET    /admin/communication/emails/:id           (with the email body)
// POST   /admin/communication/emails/:id/save      { saved: true|false }
// POST   /admin/communication/emails/:id/forward   (to the MiniGuru Gmail)
// DELETE /admin/communication/emails/:id
// GET    /admin/communication/contacts?q=
const FORWARD_TO = process.env.ADMIN_EMAIL || 'miniguru.in@gmail.com';
const DAY_MS = 86400000;
function emailState(row) {
    if (row.saved === true)
        return 'saved';
    const age = (Date.now() - new Date(row.createdAt).getTime()) / DAY_MS;
    return age >= emailLog_1.FRESH_DAYS ? 'expiring' : 'fresh';
}
router.get('/emails', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        await (0, emailLog_1.purgeOldEmails)();
        const view = String(req.query.view || 'all');
        const q = String(req.query.q || '').trim().toLowerCase();
        const db = prismaClient_1.default;
        const rows = await db.emailLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 400,
            select: { id: true, toEmail: true, subject: true, status: true, error: true, createdAt: true, fromEmail: true, kind: true, reference: true, saved: true, savedAt: true },
        });
        const withState = rows.map((r) => ({
            ...r,
            state: emailState(r),
            hasBody: r.kind !== 'security' && r.kind !== 'forward',
            deleteOn: r.saved === true ? null : new Date(new Date(r.createdAt).getTime() + emailLog_1.DELETE_AFTER_DAYS * DAY_MS).toISOString(),
        }));
        const counts = {
            all: withState.length,
            fresh: withState.filter((r) => r.state === 'fresh').length,
            expiring: withState.filter((r) => r.state === 'expiring').length,
            saved: withState.filter((r) => r.state === 'saved').length,
        };
        let list = withState;
        if (view === 'fresh' || view === 'expiring' || view === 'saved')
            list = list.filter((r) => r.state === view);
        if (q)
            list = list.filter((r) => `${r.toEmail} ${r.subject} ${r.reference || ''}`.toLowerCase().includes(q));
        const nextDelete = withState.filter((r) => r.state === 'expiring' && r.deleteOn).map((r) => r.deleteOn).sort()[0] || null;
        return res.json({ counts, nextDelete, freshDays: emailLog_1.FRESH_DAYS, deleteAfterDays: emailLog_1.DELETE_AFTER_DAYS, rows: list });
    }
    catch (error) {
        logger_1.default.error(`List emails error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to load sent emails' });
    }
});
router.get('/emails/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const row = await prismaClient_1.default.emailLog.findUnique({ where: { id: req.params.id } });
        if (!row)
            return res.status(404).json({ message: 'Email not found (it may have been deleted).' });
        return res.json({ ...row, state: emailState(row) });
    }
    catch {
        return res.status(400).json({ message: 'Could not open this email' });
    }
});
router.post('/emails/:id/save', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const saved = req.body?.saved !== false;
        const row = await prismaClient_1.default.emailLog.update({
            where: { id: req.params.id },
            data: { saved, savedAt: saved ? new Date() : null },
            select: { id: true, saved: true },
        });
        return res.json({ success: true, saved: row.saved === true });
    }
    catch {
        return res.status(404).json({ message: 'Email not found (it may have been deleted).' });
    }
});
router.post('/emails/:id/forward', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const row = await prismaClient_1.default.emailLog.findUnique({ where: { id: req.params.id } });
        if (!row)
            return res.status(404).json({ message: 'Email not found (it may have been deleted).' });
        if (!row.bodyHtml)
            return res.status(400).json({ message: 'This email has no stored content (codes and password mails are never stored), so it cannot be forwarded.' });
        const note = `<div style="font:13px Arial,sans-serif;color:#555;border-bottom:1px solid #ddd;padding:8px 0 12px;margin-bottom:12px">Forwarded from MiniGuru admin.<br/>Originally sent to <b>${escHtml(row.toEmail)}</b> on ${escHtml(new Date(row.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST.<br/>Reference: ${escHtml(row.reference || '')}</div>`;
        await (0, emailService_1.sendEmail)({
            to: FORWARD_TO,
            subject: `Fwd: ${row.subject}`.slice(0, 200),
            html: note + row.bodyHtml,
            kind: 'forward',
            reference: `Forward of an email to ${row.toEmail}`,
        });
        return res.json({ success: true, forwardedTo: FORWARD_TO });
    }
    catch (error) {
        const msg = String(error.message || '');
        if (msg.startsWith('EMAIL_QUOTA_EXCEEDED'))
            return res.status(503).json({ message: "Today's email limit is reached. Try again tomorrow." });
        logger_1.default.error(`Forward email error: ${msg}`);
        return res.status(500).json({ message: 'Could not forward the email' });
    }
});
router.delete('/emails/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        await prismaClient_1.default.emailLog.delete({ where: { id: req.params.id } });
        return res.json({ success: true });
    }
    catch {
        return res.status(404).json({ message: 'Email not found (it may already be deleted).' });
    }
});
router.get('/contacts', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        const rows = await prismaClient_1.default.emailContact.findMany({ orderBy: { lastSentAt: 'desc' }, take: 1000 });
        const list = q ? rows.filter((r) => `${r.email} ${r.lastReference || ''} ${r.lastKind || ''}`.toLowerCase().includes(q)) : rows;
        return res.json({ total: rows.length, rows: list });
    }
    catch (error) {
        logger_1.default.error(`List contacts error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to load contacts' });
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
