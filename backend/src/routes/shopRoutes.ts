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

// Optional extra recipients (other parent, school approver). The first address is
// always the main "To"; these go in CC. Max 3, valid format only, no repeats.
function parseCc(raw: any, main: string): string[] {
  const list: string[] = Array.isArray(raw)
    ? raw.map((x: any) => String(x))
    : typeof raw === 'string'
      ? raw.split(/[\s,;]+/)
      : [];
  const seen = new Set<string>([String(main || '').trim().toLowerCase()]);
  const out: string[] = [];
  for (const e of list) {
    const v = e.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 120) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= 3) break;
  }
  return out;
}

// Item name as a tagged single-item Amazon link (keeps the affiliate tag even when the
// buyer opens one item, or pays on another device than the one that opened the cart).
function itemLink(name: any, asin: any, url?: any): string {
  const n = escHtml(name);
  const a = String(asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(a)) {
    // No usable ASIN: an item the shop swapped to a tagged Amazon SEARCH link still gets a link.
    const u = String(url || '');
    if (u.indexOf('https://www.amazon.in/s?k=') === 0 && u.indexOf('tag=' + AMAZON_TAG) > 0 && u.length < 400) {
      return '<a href="' + escHtml(u) + '" style="color:inherit;text-decoration:underline">' + n + ' (search on Amazon)</a>';
    }
    return n;
  }
  return '<a href="https://www.amazon.in/dp/' + a + '?tag=' + AMAZON_TAG + '" style="color:inherit;text-decoration:underline">' + n + '</a>';
}

// "Buy" button beside each item: the single tagged item link (amazon.in/dp/ASIN?tag=...),
// the style that has always earned the affiliate commission. An item the shop swapped to a
// tagged Amazon search gets "Search"; an item with no Amazon link stays "Local".
function buyCell(asin: any, url: any, school: boolean): string {
  const btn = school
    ? 'display:inline-block;background:#f0f0f0;color:#222;text-decoration:none;padding:4px 10px;border-radius:5px;border:1px solid #ccc;font-size:12px;white-space:nowrap'
    : 'display:inline-block;background:#FF9900;color:#fff;text-decoration:none;padding:5px 12px;border-radius:14px;font-weight:700;font-size:12px;white-space:nowrap';
  const a = String(asin || '').trim().toUpperCase();
  if (/^[A-Z0-9]{10}$/.test(a)) {
    return '<a href="https://www.amazon.in/dp/' + a + '?tag=' + AMAZON_TAG + '" style="' + btn + '">Buy on Amazon &#8599;</a>';
  }
  const u = String(url || '');
  if (u.indexOf('https://www.amazon.in/s?k=') === 0 && u.indexOf('tag=' + AMAZON_TAG) > 0 && u.length < 400) {
    return '<a href="' + escHtml(u) + '" style="' + btn + '">Search &#8599;</a>';
  }
  return school
    ? '<span style="color:#666">Local</span>'
    : '<span style="background:#aaa;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">Local</span>';
}

// "Your kit" page: every item turns green once opened, so nothing is missed or opened twice.
// Only ASIN and quantity travel in the link; names and pictures load on the page from the public list.
function kitPageUrl(lines: { asin: any; qty: any }[]): string | null {
  const merged = new Map<string, number>();
  for (const l of lines) {
    const a = String(l.asin || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(a)) continue;
    merged.set(a, Math.min(999, (merged.get(a) || 0) + Math.max(1, Math.floor(Number(l.qty)) || 1)));
  }
  if (merged.size === 0) return null;
  const parts = Array.from(merged.entries()).slice(0, 80).map(([a, q]) => a + '-' + q);
  return 'https://miniguru.in/kit/?i=' + parts.join('_');
}
function kitButton(url: string | null, school: boolean): string {
  if (!url) return '';
  const style = school
    ? 'display:inline-block;background:#12B24A;color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;font-weight:700;font-size:15px'
    : 'display:inline-block;background:#12B24A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:700;font-size:15px';
  return '<div style="text-align:center;margin:12px 0 16px"><a href="' + escHtml(url) + '" style="' + style + '">&#9989; Open my kit page</a>'
    + '<p style="margin:6px 0 0;color:#666;font-size:12px">One page with all items. Each turns green after you open it, so nothing is missed.</p></div>';
}

// Caption above the quick cart. When a list needs more than one cart (10 items each), say so.
function cartNote(itemCount: number, parts: number): string {
  const caption = '<p style="margin:0 0 6px;color:#666;font-size:13px;text-align:center">Quick cart: adds all ' + itemCount + ' Amazon items at once (if Amazon shows an &quot;Add to Cart&quot; page, press it)</p>';
  if (parts < 2) return caption;
  return caption + '<p style="margin:0 0 8px;color:#B45309;font-size:13px;font-weight:700;text-align:center">They are in ' + parts + ' carts. Please open every part so no item is missed.</p>';
}

router.post('/send-to-parent', authenticateTokenOptional, async (req: any, res: Response) => {
  try {
    const { childName, parentEmail, projectTitle, items } = req.body;
    if (!parentEmail || !items || items.length === 0) {
      return res.status(400).json({ error: 'parentEmail and items are required' });
    }
    const ccList = parseCc(req.body.ccEmails, String(parentEmail));
    // School / T-LAB facilitator accounts send an official purchase request instead of a
    // child's "kit to parent". Checked on the server from the login, so it cannot be faked.
    let schoolMode = false;
    let schoolName = '';
    if (req.body.audience === 'school' && req.user?.userId) {
      const su: any = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { name: true, isMentor: true, mentorType: true, guardianInfo: true },
      });
      if (su && su.isMentor && (su.mentorType === 'SCHOOL' || su.mentorType === 'TLAB')) {
        schoolMode = true;
        schoolName = String(su.guardianInfo?.institutionName || su.name || '').trim().slice(0, 80);
      }
    }
    const ccNote = ccList.length
      ? '<p style="color:#888;font-size:12px;margin:0 0 14px">Also shared with: ' + ccList.map(escHtml).join(', ') + '</p>'
      : '';
    const amazonItems = items.filter((i: any) => i.amazonASIN);
    // Amazon allows 10 lines per cart link, so longer lists are split into parts of 10
    const cartParts: string[] = [];
    for (let s = 0; s < amazonItems.length; s += 10) {
      // 'tag' is the parameter every normal Amazon link uses; 'AssociateTag' is the cart form's own name. Sending both costs nothing.
      const params = new URLSearchParams({ AssociateTag: AMAZON_TAG, tag: AMAZON_TAG });
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
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${itemLink(item.name, item.amazonASIN, item.amazonUrl)}</strong></td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${escHtml(item.qty)} ${escHtml(item.unit || 'piece')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${item.priceEstimate ? '\u20b9' + (item.priceEstimate * item.qty) : '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${buyCell(item.amazonASIN, item.amazonUrl, false)}</td>
    </tr>`).join('');

    const childHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f7ff">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:linear-gradient(135deg,#5B6EF5,#7C3AED);padding:28px 32px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:28px">&#129504; MiniGuru</h1>
<p style="margin:6px 0 0;color:rgba(255,255,255,0.85)">STEAM Education Platform</p></div>
<div style="padding:32px">
<h2 style="color:#1a1a2e">&#128722; ${escHtml(childName || 'Your child')} needs materials!</h2>
<p style="color:#555">They planned a STEAM project${projectTitle ? ' <strong>"' + escHtml(projectTitle) + '"</strong>' : ''}. Here are the materials. Tap <strong>Buy on Amazon</strong> next to each item. Amazon opens in a <strong>new tab</strong>: press <strong>Add to Cart</strong> there. Do not forget this step.</p>
${ccNote}
<table width="100%" style="border:1px solid #eee;border-radius:8px;margin-bottom:24px">
<tr style="background:#f5f7ff"><th style="padding:10px 12px;text-align:left;color:#5B6EF5">Material</th><th style="color:#5B6EF5">Qty</th><th style="color:#5B6EF5">Est.</th><th style="color:#5B6EF5">Buy</th></tr>
${rows}
${totalEst > 0 ? '<tr style="background:#f5f7ff"><td colspan="2" style="padding:10px 12px;font-weight:700">Total</td><td style="padding:10px 12px;font-weight:700;color:#5B6EF5;text-align:right">&#8377;' + totalEst + '</td><td></td></tr>' : ''}
</table>
${kitButton(kitPageUrl(items.map((i: any) => ({ asin: i.amazonASIN, qty: i.qty }))), false)}
<p style="color:#aaa;font-size:12px;text-align:center;margin:0 0 18px">Prices are estimates. Pay via UPI, card or COD.</p>
<div style="background:#f0f4ff;border-radius:10px;padding:16px 20px">
<p style="margin:0;color:#5B6EF5;font-weight:700">&#9989; What happens next?</p>
<p style="margin:8px 0 0;color:#444">Once they get the materials, they build, film, and upload to MiniGuru. On approval they earn Goins!</p></div></div>
<div style="background:#f5f7ff;padding:20px 32px;text-align:center;border-top:1px solid #eee">
<p style="margin:0;color:#aaa;font-size:12px">MiniGuru Innovation Pvt Ltd &middot; Ujjain, Madhya Pradesh<br>
<a href="https://miniguru.in" style="color:#5B6EF5">miniguru.in</a> &middot; <a href="mailto:connect@miniguru.in" style="color:#5B6EF5">connect@miniguru.in</a></p></div></div>
</body></html>`;

    // Official, low-key purchase request (school / T-LAB accounts): plain wording, logo at the bottom.
    const forOf = (item: any) => escHtml(String(item.forWho || '').trim().slice(0, 40) || 'STEAM LAB');
    const recipient = String(req.body.recipientName || '').replace(/[<>]/g, '').trim().slice(0, 60);
    const schoolRows = items.map((item: any) => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e5e5">${itemLink(item.name, item.amazonASIN, item.amazonUrl)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e5e5;text-align:center;font-size:13px">${forOf(item)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e5e5;text-align:center">${escHtml(item.qty)} ${escHtml(item.unit || 'piece')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e5e5;text-align:right">${item.priceEstimate ? '&#8377;' + item.priceEstimate * item.qty : '-'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e5e5;text-align:center">${buyCell(item.amazonASIN, item.amazonUrl, true)}</td>
    </tr>`).join('');
    const schoolHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#ffffff;color:#222">
<div style="max-width:620px;margin:0 auto;padding:24px;font-size:15px;line-height:1.55">
<p>Dear ${recipient ? escHtml(recipient) : 'Purchase Department'},</p>
<p>The T-LAB facilitator at <strong>${escHtml(schoolName || 'our school')}</strong> requests the purchase of the items below for the STEAM LAB${projectTitle ? ' (' + escHtml(projectTitle) + ')' : ''}. Please review the list and place the order.</p>
${ccList.length ? '<p style="color:#666;font-size:13px;margin:0 0 12px">Marked to ' + ccList.map(escHtml).join(', ') + ' to keep them in the loop and for approval.</p>' : ''}
<p style="margin:0 0 6px">Tap <strong>Buy on Amazon</strong> next to each item. Amazon opens in a <strong>new tab</strong>: press <strong>Add to Cart</strong> there, then return to this list.</p>
<table width="100%" style="border-collapse:collapse;border:1px solid #e5e5e5;margin:14px 0;font-size:14px">
<tr style="background:#f6f6f6"><th style="padding:7px 10px;text-align:left">Item</th><th style="padding:7px 10px">For</th><th style="padding:7px 10px">Qty</th><th style="padding:7px 10px;text-align:right">Est.</th><th style="padding:7px 10px">Buy</th></tr>
${schoolRows}
${totalEst > 0 ? '<tr><td colspan="3" style="padding:8px 10px;font-weight:700">Estimated total</td><td style="padding:8px 10px;font-weight:700;text-align:right">&#8377;' + totalEst + '</td><td></td></tr>' : ''}
</table>
${kitButton(kitPageUrl(items.map((i: any) => ({ asin: i.amazonASIN, qty: i.qty }))), true)}
<p style="color:#888;font-size:12px;margin:8px 0 0">Prices are estimates; please check the current price on Amazon. Items marked Local are best bought nearby.</p>
<p style="margin-top:22px">Regards,<br>T-LAB facilitator, ${escHtml(schoolName || 'our school')}</p>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:26px 0 14px">
<div style="text-align:center;color:#999;font-size:12px">
<img src="https://miniguru.in/icons/Icon-192.png" width="32" height="32" alt="MiniGuru" style="border-radius:8px"><br>
Sent through MiniGuru &middot; MiniGuru Innovation Pvt Ltd, Ujjain, Madhya Pradesh<br>
<a href="https://miniguru.in" style="color:#999">miniguru.in</a> &middot; <a href="mailto:connect@miniguru.in" style="color:#999">connect@miniguru.in</a></div>
</div></body></html>`;
    const html = schoolMode ? schoolHtml : childHtml;

    await sendEmail({
      to: String(parentEmail).trim(),
      ...(ccList.length ? { cc: ccList } : {}),
      subject: schoolMode
        ? `Purchase request of STEAM items${schoolName ? ' - ' + schoolName : ''}`.slice(0, 150)
        : `Materials list for ${String(childName || 'your child').slice(0, 60)}'s STEAM project`,
      html,
      fromOverride: OFFICIAL_FROM, // now the same connect@ address as all other mail
      kind: schoolMode ? 'purchase-request' : 'kit-to-parent',
      reference: `${schoolMode ? 'Purchase request' : 'Kit'} for ${String(childName || 'a child').slice(0, 40)} - ${items.length} items${projectTitle ? ' - ' + String(projectTitle).slice(0, 60) : ''}`,
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
    // 'school' = a purchase request to a school office / approver; anything else = a parent.
    const isSchool = body.audience === 'school';
    const ccList = parseCc(body.ccEmails, email);
    const ccNote = ccList.length
      ? '<p style="color:#888;font-size:12px;margin:0 0 14px">Also shared with: ' + ccList.map(escHtml).join(', ') + '</p>'
      : '';

    // Amazon cart links: same ASIN merged, 10 lines per link.
    const merged = new Map<string, number>();
    clean.forEach((i: any) => {
      if (i.asin) merged.set(i.asin, Math.min(999, (merged.get(i.asin) || 0) + i.qty));
    });
    const asinList = Array.from(merged.entries());
    const cartUrls: string[] = [];
    for (let s = 0; s < asinList.length; s += 10) {
      // 'tag' is the parameter every normal Amazon link uses; 'AssociateTag' is the cart form's own name. Sending both costs nothing.
      const params = new URLSearchParams({ AssociateTag: AMAZON_TAG, tag: AMAZON_TAG });
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
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${itemLink(i.name, i.asin)}</strong></td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.qty} ${escHtml(i.unit)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${i.price ? '&#8377;' + i.price * i.qty : '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${buyCell(i.asin, '', false)}</td>
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
<p style="margin:6px 0 0;color:rgba(255,255,255,0.85)">${isSchool ? 'Purchase request' : 'Materials list'}</p></div>
<div style="padding:30px">
<h2 style="color:#1a1a2e;margin-top:0">&#128203; ${isSchool ? 'Purchase request: ' : ''}${escHtml(listTitle)}</h2>
<p style="color:#555">${isSchool
  ? (senderName ? escHtml(senderName) : 'A teacher') + ' is requesting your purchase of the items below. Please review the list and place the order.'
  : (senderName ? escHtml(senderName) + ' has' : 'Someone has') + ' shared this materials list with you. Quantities and items were chosen from MiniGuru\'s recommended list.'}</p>
${ccNote}
<p style="color:#555;margin:0 0 10px">Tap <strong>Buy on Amazon</strong> next to each item. Amazon opens in a <strong>new tab</strong>: press <strong>Add to Cart</strong> there, then return to this list.</p>
<table width="100%" style="border:1px solid #eee;border-radius:8px;margin-bottom:22px">
<tr style="background:#f1f8f1"><th style="padding:10px 12px;text-align:left;color:#1B5E20">Material</th><th style="color:#1B5E20">Qty</th><th style="color:#1B5E20">Est.</th><th style="color:#1B5E20">Buy</th></tr>
${rows}
${total > 0 ? '<tr style="background:#f1f8f1"><td colspan="2" style="padding:10px 12px;font-weight:700">Estimated total</td><td style="padding:10px 12px;font-weight:700;color:#1B5E20;text-align:right">&#8377;' + total + '</td><td></td></tr>' : ''}
</table>
${kitButton(kitPageUrl(asinList.map(([a, q]) => ({ asin: a, qty: q }))), isSchool)}
<p style="color:#aaa;font-size:12px;text-align:center;margin:0 0 10px">Prices are estimates — please check the current price on Amazon. Items marked Local are best bought nearby.</p>
</div>
<div style="background:#f5f7ff;padding:18px 32px;text-align:center;border-top:1px solid #eee">
<p style="margin:0;color:#aaa;font-size:12px">MiniGuru Innovation Pvt Ltd &middot; Ujjain, Madhya Pradesh<br>
<a href="https://miniguru.in" style="color:#1B5E20">miniguru.in</a> &middot; <a href="mailto:connect@miniguru.in" style="color:#1B5E20">connect@miniguru.in</a></p></div></div>
</body></html>`;

    await sendEmail({
      to: email,
      ...(ccList.length ? { cc: ccList } : {}),
      subject: (isSchool
        ? `Purchase request${senderName ? ' from ' + senderName : ''}: ${listTitle}`
        : `Materials list: ${listTitle}`).slice(0, 150),
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
