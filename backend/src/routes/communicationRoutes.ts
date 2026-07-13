// backend/src/routes/communicationRoutes.ts

import express from 'express';
import prisma from '../utils/prismaClient';
import logger from '../logger';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';
import { sendEmail } from '../services/email/emailService';
import { notifyUser, notifyManyUsers } from '../services/notificationService';

const router = express.Router();

const FROM_EMAIL = process.env.FROM_EMAIL || 'connect@miniguru.in';

function htmlWrap(title: string, body: string) {
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
    const record = await (prisma as any).contactMessage.create({
      data: { name, email, subject: subject || 'General Enquiry', message, source: source || 'app' }
    });
    // Forward to admin email
    try {
      await sendEmail({ to: process.env.ADMIN_EMAIL, subject: `[MiniGuru Inbox] ${subject || 'New message'} — from ${name}`, html: "" });
    } catch (mailErr) {
      logger.warn(`Contact form: admin notify failed — ${(mailErr as Error).message}`);
    }
    return res.status(201).json({ success: true, id: record.id });
  } catch (error) {
    logger.error(`POST /communication/contact: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to submit message' });
  }
});

// ── ADMIN: GET /admin/communication/inbox ──────────────────────────────────
router.get('/inbox', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const messages = await (prisma as any).contactMessage.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch inbox' });
  }
});

// ── ADMIN: PUT /admin/communication/inbox/:id ──────────────────────────────
router.put('/inbox/:id', authenticateToken, authorizeAdmin, async (req: any, res) => {
  try {
    const { status } = req.body; // unread | read | replied
    const updated = await (prisma as any).contactMessage.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'replied' ? { repliedAt: new Date(), repliedBy: req.user?.userId } : {})
      }
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update message' });
  }
});

// ── ADMIN: DELETE /admin/communication/inbox/:id ───────────────────────────
router.delete('/inbox/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    await (prisma as any).contactMessage.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (error) {
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
router.post('/broadcast', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { subject, message, alsoEmail } = req.body;
    if (!subject || !message) return res.status(400).json({ message: 'subject and message required' });

    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
    if (users.length === 0) return res.status(400).json({ message: 'No users found' });

    await notifyManyUsers({
      userIds: users.map((u) => u.id),
      type: 'broadcast',
      emoji: '📣',
      message: `${subject} — ${message}`,
    });

    let sent = 0;
    let failed = 0;
    if (alsoEmail === true) {
      for (const user of users) {
        try {
          await sendEmail({ to: user.email, subject, html: htmlWrap(subject, `<p>${message}</p>`) });
          sent++;
        } catch { failed++; }
      }
    }

    logger.info(
      `Broadcast: ${users.length} in-app notifications created` +
      (alsoEmail ? `, ${sent} emailed (${failed} failed)` : ' — no email sent (in-app only)')
    );
    return res.json({ success: true, notified: users.length, emailed: sent, emailFailed: failed, total: users.length });
  } catch (error) {
    logger.error(`Broadcast error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Broadcast failed' });
  }
});

// ── ADMIN: POST /admin/communication/send ──────────────────────────────────
// In-app notification to one user by default. Pass alsoEmail: true to also
// send a real email (e.g. reaching someone who doesn't check the app often).
router.post('/send', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { userId, email: toEmail, subject, message, alsoEmail } = req.body;
    if (!subject || !message) return res.status(400).json({ message: 'subject and message required' });
    if (!userId && !toEmail) return res.status(400).json({ message: 'userId or email required' });

    let recipient: { id: string; email: string; name: string } | null = null;
    if (userId) {
      recipient = await prisma.user.findUnique({
        where: { id: userId }, select: { id: true, email: true, name: true }
      });
    } else {
      recipient = await prisma.user.findUnique({
        where: { email: toEmail }, select: { id: true, email: true, name: true }
      });
    }
    if (!recipient) return res.status(404).json({ message: 'User not found' });

    await notifyUser({
      userId: recipient.id,
      type: 'direct',
      emoji: '✉️',
      message: `${subject} — ${message}`,
    });

    let emailed = false;
    if (alsoEmail === true) {
      await sendEmail({ to: recipient.email, subject, html: htmlWrap(subject, `<p>${message}</p>`) });
      emailed = true;
    }
    logger.info(`Direct message sent to ${recipient.email} (in-app${emailed ? ' + email' : ' only'})`);
    return res.json({ success: true, sentTo: recipient.email, emailed });
  } catch (error) {
    logger.error(`Direct send error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to send message' });
  }
});

// ── ADMIN: GET /admin/communication/users ──────────────────────────────────
// For the direct message user picker
router.get('/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' }
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// ── ADMIN: POST /admin/communication/announcement ──────────────────────────
// Store an in-app announcement (Flutter reads from /cms/announcements)
router.post('/announcement', authenticateToken, authorizeAdmin, async (req: any, res) => {
  try {
    const { title, body, type, expiresAt } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'title and body required' });

    const existing = await (prisma as any).siteContent.findUnique({ where: { key: 'announcements' } });
    const list = (existing?.value as any[]) || [];
    list.unshift({
      id: Date.now().toString(),
      title, body,
      type: type || 'info',   // info | warning | success | promo
      expiresAt: expiresAt || null,
      createdAt: new Date().toISOString(),
      createdBy: req.user?.userId,
    });
    // Keep last 20 announcements
    const trimmed = list.slice(0, 20);
    await (prisma as any).siteContent.upsert({
      where:  { key: 'announcements' },
      update: { value: trimmed },
      create: { key: 'announcements', value: trimmed },
    });
    return res.json({ success: true, total: trimmed.length });
  } catch (error) {
    logger.error(`Announcement error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to save announcement' });
  }
});

// ── ADMIN: DELETE /admin/communication/announcement/:id ────────────────────
router.delete('/announcement/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const existing = await (prisma as any).siteContent.findUnique({ where: { key: 'announcements' } });
    const list = ((existing?.value as any[]) || []).filter((a: any) => a.id !== req.params.id);
    await (prisma as any).siteContent.upsert({
      where:  { key: 'announcements' },
      update: { value: list },
      create: { key: 'announcements', value: list },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete announcement' });
  }
});

export default router;