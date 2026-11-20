"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERIFY_CODE_HOURS = void 0;
exports.verifyLinkUrl = verifyLinkUrl;
exports.readVerifyToken = readVerifyToken;
exports.verifyButtonHtml = verifyButtonHtml;
// One-tap email verification link (Nov 2026). The link carries a signed token (24 hours) for one
// user + one email address. Opening it shows a "Confirm" button; tapping that button verifies the email.
// (The extra tap stops email security scanners, which open links on their own, from verifying by themselves.)
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const SECRET = () => process.env.JWT_SECRET || 'miniguru-reset-secret';
const BASE = () => process.env.BACKEND_PUBLIC_URL || 'https://miniguru-backend-130420985234.asia-south1.run.app';
exports.VERIFY_CODE_HOURS = 24;
function verifyLinkUrl(userId, email) {
    const t = jsonwebtoken_1.default.sign({ userId, email: email.trim().toLowerCase(), purpose: 'verify-email' }, SECRET(), { expiresIn: `${exports.VERIFY_CODE_HOURS}h` });
    return `${BASE()}/auth/verify-link?t=${encodeURIComponent(t)}`;
}
function readVerifyToken(t) {
    try {
        const p = jsonwebtoken_1.default.verify(t, SECRET());
        if (p?.purpose !== 'verify-email' || !p.userId || !p.email)
            return null;
        return { userId: String(p.userId), email: String(p.email) };
    }
    catch {
        return null;
    }
}
function verifyButtonHtml(url) {
    return `<p style="margin:18px 0"><a href="${url}" style="background:#5B6EF5;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px;display:inline-block">Verify my email</a></p>
<p style="color:#888;font-size:13px">Or type the code above in the app. The button and the code both work for ${exports.VERIFY_CODE_HOURS} hours.</p>`;
}
