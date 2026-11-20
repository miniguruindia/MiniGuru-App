// POST /support/report  - "Report a problem" from the app. Works logged in or logged out.
// Sends one email to the MiniGuru team (the ADMIN_EMAIL setting) with who, which page, and the phone/browser.
// Nothing is stored in the database.
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient';
import { sendEmail } from '../services/emailService';
import logger from '../logger';

const router = Router();
const hits = new Map<string, number[]>();   // key -> times of recent reports (max 5 per hour)
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

router.post('/report', async (req: Request, res: Response) => {
  const message = String(req.body?.message ?? '').trim().slice(0, 2000);
  const page = String(req.body?.page ?? '').trim().slice(0, 100);
  if (message.length < 5) return res.status(400).json({ error: 'Please tell us a little more about the problem.' });

  let who = 'Not logged in';
  let key = String(req.headers['x-forwarded-for'] || req.ip || 'x').split(',')[0].trim();
  try {
    const h = req.headers.authorization;
    if (h && h.startsWith('Bearer ') && process.env.JWT_SECRET) {
      const d: any = jwt.verify(h.substring(7), process.env.JWT_SECRET);
      const u = await prisma.user.findUnique({ where: { id: d.userId }, select: { id: true, name: true, email: true, guardianEmail: true, isMentor: true } });
      if (u) {
        who = `${u.name} (${u.email})${u.isMentor ? ' [teacher/parent/school]' : ''}${u.guardianEmail ? ' - contact: ' + u.guardianEmail : ''}`;
        key = u.id;
      }
    }
  } catch { /* logged-out or expired token: still accept the report */ }

  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < 3600_000);
  if (recent.length >= 5) return res.status(429).json({ error: 'You have sent a few reports already. Please try again in a while.' });

  const inbox = String(process.env.ADMIN_EMAIL || '').trim();
  if (!inbox) {
    logger.error('problem report: ADMIN_EMAIL is not set');
    return res.status(502).json({ error: 'Could not send right now. Please write to connect@miniguru.in.' });
  }
  try {
    await sendEmail({
      to: inbox,
      subject: `MiniGuru problem report${page ? ' - ' + page : ''}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px">
        <p><b>From:</b> ${esc(who)}</p>
        <p><b>Page:</b> ${esc(page || 'not given')}</p>
        <p><b>Phone / browser:</b> ${esc(String(req.headers['user-agent'] || 'unknown').slice(0, 250))}</p>
        <p><b>Time:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
        <hr><p style="white-space:pre-wrap">${esc(message)}</p></div>`,
    });
    recent.push(now);
    hits.set(key, recent);
    return res.json({ ok: true });
  } catch (e: any) {
    logger.error({ err: e?.message }, 'problem report email failed');
    return res.status(502).json({ error: 'Could not send right now. Please write to connect@miniguru.in.' });
  }
});

export default router;
