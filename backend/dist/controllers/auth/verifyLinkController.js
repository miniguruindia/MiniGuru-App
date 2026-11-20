"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmVerifyLink = exports.showVerifyLink = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const verifyLink_1 = require("../../services/verifyLink");
const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page(title, body) {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MiniGuru</title></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#F4F6FF"><div style="max-width:440px;margin:40px auto;background:#fff;border-radius:16px;padding:28px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<h2 style="color:#5B6EF5;margin-top:0">${esc(title)}</h2>${body}
<p style="margin-top:24px"><a href="https://miniguru.in" style="color:#5B6EF5;font-weight:700">Open MiniGuru</a></p></div></body></html>`;
}
const showVerifyLink = (req, res) => {
    const t = String(req.query.t || '');
    if (!(0, verifyLink_1.readVerifyToken)(t)) {
        return res.status(400).send(page('This link has expired', '<p>Please open MiniGuru, go to Profile, and tap Verify to get a new one.</p>'));
    }
    res.send(page('Verify your email', `<p>Tap the button to confirm your email address.</p>
<form method="post" action="/auth/verify-link"><input type="hidden" name="t" value="${esc(t)}">
<button type="submit" style="background:#5B6EF5;color:#fff;border:0;font-weight:800;font-size:16px;padding:12px 26px;border-radius:10px;cursor:pointer">Confirm my email</button></form>`));
};
exports.showVerifyLink = showVerifyLink;
const confirmVerifyLink = async (req, res) => {
    const tok = (0, verifyLink_1.readVerifyToken)(String(req.body?.t || ''));
    if (!tok) {
        return res.status(400).send(page('This link has expired', '<p>Please open MiniGuru, go to Profile, and tap Verify to get a new one.</p>'));
    }
    try {
        const user = await prismaClient_1.default.user.findUnique({ where: { id: tok.userId } });
        const current = ((user?.guardianEmail || user?.email) || '').trim().toLowerCase();
        if (!user || current !== tok.email) {
            return res.status(400).send(page('This link is for an older email address', '<p>The email on your account has changed. Please verify again from Profile.</p>'));
        }
        if (!user.emailVerified) {
            await prismaClient_1.default.user.update({
                where: { id: user.id },
                data: { emailVerified: true, verificationOtpHash: null, verificationOtpExpiry: null, verificationOtpTarget: null },
            });
        }
        res.send(page('Email verified ✅', '<p>Thank you! You can go back to MiniGuru now. If it is open, reopen your Profile to see the green "Verified" tag.</p>'));
    }
    catch {
        res.status(500).send(page('Something went wrong', '<p>Please try again in a moment.</p>'));
    }
};
exports.confirmVerifyLink = confirmVerifyLink;
