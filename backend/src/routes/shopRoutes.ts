import { Router, Request, Response } from 'express';
import { sendEmail, OFFICIAL_FROM } from '../services/email/emailService';
import prisma from '../utils/prismaClient';
import { authenticateTokenOptional, authenticateToken } from '../middleware/authMiddleware';
import { resolveSubject } from '../middleware/resolveSubject';

const router = Router();



const AMAZON_TAG = 'miniguru04-21';
const FROM_EMAIL = process.env.FROM_EMAIL || 'connect@miniguru.in';

// Records one emailed materials list for the admin "tentative earnings"
// estimate. Never blocks or fails the email: any problem is only logged.
async function recordListShare(source: string, senderName: string, rows: { asin: boolean; price: number; qty: number }[]) {
  try {
    const itemCount = rows.length;
    const amazonRows = rows.filter((r) => r.asin);
    const amazonValue = Math.round(amazonRows.reduce((s, r) => s + r.price * r.qty, 0));
    const totalValue = Math.round(rows.reduce((s, r) => s + r.price * r.qty, 0));
    await prisma.listShare.create({
      data: {
        source,
        senderName: senderName ? senderName.slice(0, 80) : null,
        itemCount,
        amazonItems: amazonRows.length,
        amazonValue,
        totalValue,
      },
    });
  } catch (e: any) {
    console.error('recordListShare failed (email was still sent):', e?.message || e);
  }
}

router.post('/send-to-parent', async (req: Request, res: Response) => {
  try {
    const { childName, parentEmail, projectTitle, items } = req.body;
    if (!parentEmail || !items || items.length === 0) {
      return res.status(400).json({ error: 'parentEmail and items are required' });
    }
    const amazonItems = items.filter((i: any) => i.amazonASIN);
    // Amazon allows 10 lines per cart link, so longer lists are split into parts of 10
    const cartParts: string[] = [];
    for (let s = 0; s < amazonItems.length; s += 10) {
      const params = new URLSearchParams({ AssociateTag: AMAZON_TAG });
      amazonItems.slice(s, s + 10).forEach((item: any, i: number) => {
        params.append(`ASIN.${i + 1}`, item.amazonASIN);
        params.append(`Quantity.${i + 1}`, String(item.qty));
      });
      cartParts.push(`https://www.amazon.in/gp/aws/cart/add.html?${params.toString()}`);
    }
    const amazonCartUrl: string | null = cartParts.length > 0 ? cartParts[0] : null;
    const cartButtonsHtml = cartParts.map((u, idx) =>
      '<a href="' + u + '" style="display:inline-block;margin:6px;background:#FF9900;color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:16px">&#128717; Buy on Amazon' + (cartParts.length > 1 ? ' — part ' + (idx + 1) + ' of ' + cartParts.length : '') + '</a>'
    ).join('');
    const totalEst = items.reduce((s: number, i: any) => s + (i.priceEstimate || 0) * i.qty, 0);
    const rows = items.map((item: any) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${escHtml(item.name)}</strong></td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${escHtml(item.qty)} ${escHtml(item.unit || 'piece')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${item.priceEstimate ? '\u20b9' + (item.priceEstimate * item.qty) : '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.amazonASIN ? '<span style="background:#FF9900;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">Amazon</span>' : '<span style="background:#aaa;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">Local</span>'}</td>
    </tr>`).join('');

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f7ff">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:linear-gradient(135deg,#5B6EF5,#7C3AED);padding:28px 32px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:28px">&#129504; MiniGuru</h1>
<p style="margin:6px 0 0;color:rgba(255,255,255,0.85)">STEAM Education Platform</p></div>
<div style="padding:32px">
<h2 style="color:#1a1a2e">&#128722; ${escHtml(childName || 'Your child')} needs materials!</h2>
<p style="color:#555">They planned a STEAM project${projectTitle ? ' <strong>"' + escHtml(projectTitle) + '"</strong>' : ''}. Here are the materials:</p>
<table width="100%" style="border:1px solid #eee;border-radius:8px;margin-bottom:24px">
<tr style="background:#f5f7ff"><th style="padding:10px 12px;text-align:left;color:#5B6EF5">Material</th><th style="color:#5B6EF5">Qty</th><th style="color:#5B6EF5">Est.</th><th style="color:#5B6EF5">Source</th></tr>
${rows}
${totalEst > 0 ? '<tr style="background:#f5f7ff"><td colspan="2" style="padding:10px 12px;font-weight:700">Total</td><td style="padding:10px 12px;font-weight:700;color:#5B6EF5;text-align:right">&#8377;' + totalEst + '</td><td></td></tr>' : ''}
</table>
${cartButtonsHtml ? '<div style="text-align:center;margin:28px 0">' + cartButtonsHtml + '<p style="color:#aaa;font-size:12px;margin:10px 0 0">Cart pre-filled. Pay via UPI, card or COD.</p></div>' : ''}
<div style="background:#f0f4ff;border-radius:10px;padding:16px 20px">
<p style="margin:0;color:#5B6EF5;font-weight:700">&#9989; What happens next?</p>
<p style="margin:8px 0 0;color:#444">Once they get the materials, they build, film, and upload to MiniGuru. On approval they earn Goins!</p></div></div>
<div style="background:#f5f7ff;padding:20px 32px;text-align:center;border-top:1px solid #eee">
<p style="margin:0;color:#aaa;font-size:12px">MiniGuru Innovation Pvt Ltd &middot; Ujjain, Madhya Pradesh<br>
<a href="https://miniguru.in" style="color:#5B6EF5">miniguru.in</a> &middot; <a href="mailto:connect@miniguru.in" style="color:#5B6EF5">connect@miniguru.in</a></p></div></div>
</body></html>`;

    await sendEmail({
      to: String(parentEmail).trim(),
      subject: `Materials list for ${String(childName || 'your child').slice(0, 60)}'s STEAM project`,
      html,
      fromOverride: OFFICIAL_FROM, // now the same connect@ address as all other mail
      kind: 'kit-to-parent',
      reference: `Kit for ${String(childName || 'a child').slice(0, 40)} - ${items.length} items${projectTitle ? ' - ' + String(projectTitle).slice(0, 60) : ''}`,
    });
    await recordListShare(
      'send-to-parent',
      String(childName || ''),
      items.map((i: any) => ({
        asin: !!i.amazonASIN,
        price: Number(i.priceEstimate) > 0 ? Number(i.priceEstimate) : 0,
        qty: Math.max(1, Math.min(999, Math.floor(Number(i.qty)) || 1)),
      }))
    );
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
      kind: 'materials-list',
      reference: `List "${listTitle.slice(0, 60)}"${senderName ? ' by ' + senderName : ''} - ${clean.length} items`,
    });
    listSendLog.set(ip, [...recent, now]);
    await recordListShare(
      'send-list',
      senderName,
      clean.map((i: any) => ({ asin: !!i.asin, price: i.price, qty: i.qty }))
    );
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
    // A product found on Amazon is suggested only once per person (visitors: once overall).
    const asinMatch = String(suggestion).match(/\/dp\/([A-Z0-9]{10})/);
    // Visitors who are not logged in never create suggestions from Amazon search
    // (this also covers older app versions that still send them).
    if (asinMatch && !loggedInUser?.id) {
      return res.status(201).json({ success: true, message: 'Thanks for your suggestion!' });
    }
    if (asinMatch) {
      const dup = await (prisma as any).productSuggestion.findFirst({
        where: {
          suggestion: { contains: asinMatch[1] },
          ...(loggedInUser?.id ? { userId: loggedInUser.id } : {}),
        },
        select: { id: true },
      });
      if (dup) return res.status(201).json({ success: true, message: 'Thanks for your suggestion!' });
    }
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

// ── Saved items: Amazon products kept for later buying (Oct 2026) ───────────
router.get('/saved', authenticateToken, resolveSubject, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const items = await (prisma as any).savedItem.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Could not load saved items' });
  }
});

router.post('/saved', authenticateToken, resolveSubject, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const asin = String(req.body?.asin || '').trim().toUpperCase();
    const title = String(req.body?.title || '').trim().slice(0, 200);
    if (!/^[A-Z0-9]{10}$/.test(asin) || !title) return res.status(400).json({ error: 'asin and title are required' });
    const db: any = prisma;
    const existing = await db.savedItem.findFirst({ where: { userId, asin } });
    if (existing) return res.json({ item: existing, already: true });
    const count = await db.savedItem.count({ where: { userId } });
    if (count >= 50) return res.status(400).json({ error: 'You have 50 saved items. Remove one first.' });
    const price = Number(req.body?.priceRupees);
    const item = await db.savedItem.create({
      data: {
        userId, asin, title,
        imageUrl: req.body?.imageUrl ? String(req.body.imageUrl).slice(0, 500) : null,
        priceRupees: Number.isFinite(price) && price >= 0 ? Math.round(price) : null,
        seller: req.body?.seller ? String(req.body.seller).slice(0, 120) : null,
      },
    });
    res.status(201).json({ item });
  } catch (err) {
    res.status(500).json({ error: 'Could not save this item' });
  }
});

router.delete('/saved/:id', authenticateToken, resolveSubject, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const db: any = prisma;
    const row = await db.savedItem.findFirst({ where: { id: req.params.id, userId } });
    if (!row) return res.status(404).json({ error: 'Not found' });
    await db.savedItem.delete({ where: { id: row.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not remove this item' });
  }
});

export default router;
