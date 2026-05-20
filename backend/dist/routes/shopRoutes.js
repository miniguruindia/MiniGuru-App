"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nodemailer_1 = __importDefault(require("nodemailer"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const router = (0, express_1.Router)();
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
});
const AMAZON_TAG = 'miniguru08-21';
const FROM_EMAIL = process.env.FROM_EMAIL || 'connect@miniguru.in';
router.post('/send-to-parent', async (req, res) => {
    try {
        const { childName, parentEmail, projectTitle, items } = req.body;
        if (!parentEmail || !items || items.length === 0) {
            return res.status(400).json({ error: 'parentEmail and items are required' });
        }
        const amazonItems = items.filter((i) => i.amazonASIN);
        let amazonCartUrl = null;
        if (amazonItems.length > 0) {
            const base = 'https://www.amazon.in/gp/aws/cart/add.html';
            const params = new URLSearchParams({ AssociateTag: AMAZON_TAG });
            amazonItems.forEach((item, i) => {
                params.append(`ASIN.${i + 1}`, item.amazonASIN);
                params.append(`Quantity.${i + 1}`, String(item.qty));
            });
            amazonCartUrl = `${base}?${params.toString()}`;
        }
        const totalEst = items.reduce((s, i) => s + (i.priceEstimate || 0) * i.qty, 0);
        const rows = items.map((item) => `<tr>
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
        await transporter.sendMail({
            from: `"MiniGuru" <${FROM_EMAIL}>`,
            to: parentEmail,
            subject: `&#128722; ${childName || 'Your child'} needs materials for their STEAM project!`,
            html,
        });
        return res.status(200).json({ success: true, amazonCartUrl, itemCount: items.length });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to send email', detail: err.message });
    }
});
router.post('/suggest', async (req, res) => {
    try {
        const { childName, suggestion, category } = req.body;
        if (!suggestion || suggestion.trim().length < 3) {
            return res.status(400).json({ error: 'suggestion required (min 3 chars)' });
        }
        await prismaClient_1.default.productSuggestion.create({
            data: {
                childName: childName?.trim() || null,
                userId: null,
                suggestion: suggestion.trim(),
                category: category?.trim() || null,
            },
        });
        return res.status(201).json({ success: true, message: 'Thanks for your suggestion!' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to save suggestion' });
    }
});
exports.default = router;
