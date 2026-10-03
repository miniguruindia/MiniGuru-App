import { Router, Request, Response } from 'express';
import { sendEmail, OFFICIAL_FROM } from '../services/email/emailService';
import prisma from '../utils/prismaClient';
import { authenticateTokenOptional } from '../middleware/authMiddleware';

const router = Router();



const AMAZON_TAG = 'miniguru04-21';
const FROM_EMAIL = process.env.FROM_EMAIL || 'connect@miniguru.in';

router.post('/send-to-parent', async (req: Request, res: Response) => {
  try {
    const { childName, parentEmail, projectTitle, items } = req.body;
    if (!parentEmail || !items || items.length === 0) {
      return res.status(400).json({ error: 'parentEmail and items are required' });
    }
    const amazonItems = items.filter((i: any) => i.amazonASIN);
    let amazonCartUrl: string | null = null;
    if (amazonItems.length > 0) {
      const base = 'https://www.amazon.in/gp/aws/cart/add.html';
      const params = new URLSearchParams({ AssociateTag: AMAZON_TAG });
      amazonItems.forEach((item: any, i: number) => {
        params.append(`ASIN.${i + 1}`, item.amazonASIN);
        params.append(`Quantity.${i + 1}`, String(item.qty));
      });
      amazonCartUrl = `${base}?${params.toString()}`;
    }
    const totalEst = items.reduce((s: number, i: any) => s + (i.priceEstimate || 0) * i.qty, 0);
    const rows = items.map((item: any) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${item.name}</strong></td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.qty} ${item.unit || 'piece'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${item.priceEstimate ? '\u20b9' + (item.priceEstimate * item.qty) : '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.amazonASIN ? '<span style="background:#FF9900;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">Amazon</span>' : '<span style="background:#aaa;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">Local</span>'}</td>
    </tr>`).join('');

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f7ff">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:linear-gradient(135deg,#5B6EF5,#7C3AED);padding:28px 32px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:28px">&#129504; MiniGuru</h1>
<p style="margin:6px 0 0;color:rgba(255,255,255,0.85)">STEAM Education Platform</p></div>
<div style="padding:32px">
<h2 style="color:#1a1a2e">&#128722; ${childName || 'Your child'} needs materials!</h2>
<p style="color:#555">They planned a STEAM project${projectTitle ? ' <strong>"' + projectTitle + '"</strong>' : ''}. Here are the materials:</p>
<table width="100%" style="border:1px solid #eee;border-radius:8px;margin-bottom:24px">
<tr style="background:#f5f7ff"><th style="padding:10px 12px;text-align:left;color:#5B6EF5">Material</th><th style="color:#5B6EF5">Qty</th><th style="color:#5B6EF5">Est.</th><th style="color:#5B6EF5">Source</th></tr>
${rows}
${totalEst > 0 ? '<tr style="background:#f5f7ff"><td colspan="2" style="padding:10px 12px;font-weight:700">Total</td><td style="padding:10px 12px;font-weight:700;color:#5B6EF5;text-align:right">&#8377;' + totalEst + '</td><td></td></tr>' : ''}
</table>
${amazonCartUrl ? '<div style="text-align:center;margin:28px 0"><a href="' + amazonCartUrl + '" style="background:#FF9900;color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:16px">&#128717; Buy on Amazon</a><p style="color:#aaa;font-size:12px;margin:10px 0 0">Cart pre-filled. Pay via UPI, card or COD.</p></div>' : ''}
<div style="background:#f0f4ff;border-radius:10px;padding:16px 20px">
<p style="margin:0;color:#5B6EF5;font-weight:700">&#9989; What happens next?</p>
<p style="margin:8px 0 0;color:#444">Once they get the materials, they build, film, and upload to MiniGuru. On approval they earn Goins!</p></div></div>
<div style="background:#f5f7ff;padding:20px 32px;text-align:center;border-top:1px solid #eee">
<p style="margin:0;color:#aaa;font-size:12px">MiniGuru Innovation Pvt Ltd &middot; Ujjain, Madhya Pradesh<br>
<a href="https://miniguru.in" style="color:#5B6EF5">miniguru.in</a> &middot; <a href="mailto:connect@miniguru.in" style="color:#5B6EF5">connect@miniguru.in</a></p></div></div>
</body></html>`;

    await sendEmail({
      to: parentEmail,
      subject: `\u{1F6D2} ${childName || 'Your child'} needs materials for their STEAM project!`,
      html,
      fromOverride: OFFICIAL_FROM, // lower-stakes mail, connect@ reserved for OTP/reset
    });
    return res.status(200).json({ success: true, amazonCartUrl, itemCount: items.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
});

// ── POST /shop/send-list ─────────────────────────────────────────────────────
// Emails a materials LIST (a T-LAB / Home Corner kit) to a parent or a school
// purchase department. Separate from /send-to-parent (children's flow, left
// untouched): neutral wording, Amazon cart links in parts of 10 lines, same
// ASIN merged, user text HTML-escaped, and a small per-IP limit because the
// endpoint is public.
const listSendLog = new Map<string, number[]>();

function escHtml(s: any): string {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

router.post('/send-list', async (req: Request, res: Response) => {
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const recent = (listSendLog.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
    if (recent.length >= 5) {
      return res.status(429).json({ error: 'Too many emails sent from here — please try again in an hour.' });
    }

    const body = req.body || {};
    const email = typeof body.recipientEmail === 'string' ? body.recipientEmail.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 150) {
      return res.status(400).json({ error: 'The list needs between 1 and 150 items.' });
    }

    const clean = body.items
      .map((i: any) => ({
        name: String((i && i.name) || '').slice(0, 120),
        qty: Math.max(1, Math.min(999, Math.floor(Number(i && i.qty)) || 1)),
        unit: String((i && i.unit) || 'piece').slice(0, 40),
        asin: /^[A-Z0-9]{10}$/i.test(String((i && i.amazonASIN) || '')) ? String(i.amazonASIN).toUpperCase() : '',
        price: Number(i && i.priceEstimate) > 0 ? Math.round(Number(i.priceEstimate)) : 0,
      }))
      .filter((i: any) => i.name);
    if (clean.length === 0) {
      return res.status(400).json({ error: 'The list is empty.' });
    }

    const listTitle = String(body.listTitle || 'Materials list').slice(0, 100);
    const senderName = String(body.senderName || '').trim().slice(0, 80);

    // Amazon cart links: same ASIN merged, 10 lines per link.
    const merged = new Map<string, number>();
    clean.forEach((i: any) => {
      if (i.asin) merged.set(i.asin, Math.min(999, (merged.get(i.asin) || 0) + i.qty));
    });
    const asinList = Array.from(merged.entries());
    const cartUrls: string[] = [];
    for (let s = 0; s < asinList.length; s += 10) {
      const params = new URLSearchParams({ AssociateTag: AMAZON_TAG });
      asinList.slice(s, s + 10).forEach(([asin, qty], idx) => {
        params.append(`ASIN.${idx + 1}`, asin);
        params.append(`Quantity.${idx + 1}`, String(qty));
      });
      cartUrls.push(`https://www.amazon.in/gp/aws/cart/add.html?${params.toString()}`);
    }

    const total = clean.reduce((sum: number, i: any) => sum + i.price * i.qty, 0);
    const rows = clean
      .map(
        (i: any) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${escHtml(i.name)}</strong></td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.qty} ${escHtml(i.unit)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${i.price ? '&#8377;' + i.price * i.qty : '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.asin ? '<span style="background:#FF9900;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">Amazon</span>' : '<span style="background:#aaa;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">Local</span>'}</td>
    </tr>`
      )
      .join('');

    const buttons = cartUrls
      .map(
        (u, idx) =>
          `<a href="${u}" style="display:inline-block;margin:6px;background:#FF9900;color:#fff;text-decoration:none;padding:13px 28px;border-radius:50px;font-weight:700;font-size:15px">&#128717; Buy on Amazon${cartUrls.length > 1 ? ' — part ' + (idx + 1) + ' of ' + cartUrls.length : ''}</a>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f7ff">
<div style="max-width:640px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:26px 32px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:26px">&#129504; MiniGuru</h1>
<p style="margin:6px 0 0;color:rgba(255,255,255,0.85)">Materials list</p></div>
<div style="padding:30px">
<h2 style="color:#1a1a2e;margin-top:0">&#128203; ${escHtml(listTitle)}</h2>
<p style="color:#555">${senderName ? escHtml(senderName) + ' has' : 'Someone has'} shared this materials list with you. Quantities and items were chosen from MiniGuru's recommended list.</p>
<table width="100%" style="border:1px solid #eee;border-radius:8px;margin-bottom:22px">
<tr style="background:#f1f8f1"><th style="padding:10px 12px;text-align:left;color:#1B5E20">Material</th><th style="color:#1B5E20">Qty</th><th style="color:#1B5E20">Est.</th><th style="color:#1B5E20">Source</th></tr>
${rows}
${total > 0 ? '<tr style="background:#f1f8f1"><td colspan="2" style="padding:10px 12px;font-weight:700">Estimated total</td><td style="padding:10px 12px;font-weight:700;color:#1B5E20;text-align:right">&#8377;' + total + '</td><td></td></tr>' : ''}
</table>
${buttons ? '<div style="text-align:center;margin:26px 0">' + buttons + '<p style="color:#aaa;font-size:12px;margin:10px 0 0">Carts are pre-filled. Prices are estimates — please check the current price on Amazon. Items marked Local are best bought nearby.</p></div>' : ''}
</div>
<div style="background:#f5f7ff;padding:18px 32px;text-align:center;border-top:1px solid #eee">
<p style="margin:0;color:#aaa;font-size:12px">MiniGuru Innovation Pvt Ltd &middot; Ujjain, Madhya Pradesh<br>
<a href="https://miniguru.in" style="color:#1B5E20">miniguru.in</a> &middot; <a href="mailto:connect@miniguru.in" style="color:#1B5E20">connect@miniguru.in</a></p></div></div>
</body></html>`;

    await sendEmail({
      to: email,
      subject: `Materials list: ${listTitle}`.slice(0, 150),
      html,
      fromOverride: OFFICIAL_FROM,
    });
    listSendLog.set(ip, [...recent, now]);
    return res.status(200).json({ success: true, itemCount: clean.length, cartParts: cartUrls.length });
  } catch (err: any) {
    if (String((err && err.message) || '').includes('EMAIL_QUOTA_EXCEEDED')) {
      return res.status(503).json({ error: "We've reached today's email limit — please try again tomorrow." });
    }
    console.error('POST /shop/send-list error:', err);
    return res.status(500).json({ error: 'Could not send the email right now.' });
  }
});

// Stays public/no-auth-required — a child suggesting a material while
// planning may not always be mid-session-valid. But when a valid token
// IS present, authenticateTokenOptional attaches it so the suggestion
// isn't attributed to "Anonymous" for no reason.
router.post('/suggest', authenticateTokenOptional, async (req: Request, res: Response) => {
  try {
    const { childName, suggestion, category, requestedGoinsPrice, projectContext } = req.body;
    if (!suggestion || suggestion.trim().length < 3) {
      return res.status(400).json({ error: 'suggestion required (min 3 chars)' });
    }
    let goinsPrice: number | null = null;
    if (requestedGoinsPrice !== undefined && requestedGoinsPrice !== null && requestedGoinsPrice !== '') {
      const parsed = parseInt(String(requestedGoinsPrice), 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100000) goinsPrice = parsed;
    }
    const loggedInUser = (req as any).user;
    await (prisma as any).productSuggestion.create({
      data: {
        childName: loggedInUser?.name || childName?.trim() || null,
        userId: loggedInUser?.id || null,
        suggestion: suggestion.trim(),
        category: category?.trim() || null,
        requestedGoinsPrice: goinsPrice,
        projectContext: projectContext?.trim() || null,
      },
    });
    return res.status(201).json({ success: true, message: 'Thanks for your suggestion!' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save suggestion' });
  }
});

export default router;
