// One-tap email verification link (Nov 2026). The link carries a signed token (24 hours) for one
// user + one email address. Opening it shows a "Confirm" button; tapping that button verifies the email.
// (The extra tap stops email security scanners, which open links on their own, from verifying by themselves.)
import jwt from 'jsonwebtoken';

const SECRET = () => process.env.JWT_SECRET || 'miniguru-reset-secret';
const BASE = () => process.env.BACKEND_PUBLIC_URL || 'https://miniguru-backend-130420985234.asia-south1.run.app';

export const VERIFY_CODE_HOURS = 24;

export function verifyLinkUrl(userId: string, email: string): string {
  const t = jwt.sign({ userId, email: email.trim().toLowerCase(), purpose: 'verify-email' }, SECRET(), { expiresIn: `${VERIFY_CODE_HOURS}h` });
  return `${BASE()}/auth/verify-link?t=${encodeURIComponent(t)}`;
}

export function readVerifyToken(t: string): { userId: string; email: string } | null {
  try {
    const p: any = jwt.verify(t, SECRET());
    if (p?.purpose !== 'verify-email' || !p.userId || !p.email) return null;
    return { userId: String(p.userId), email: String(p.email) };
  } catch {
    return null;
  }
}

export function verifyButtonHtml(url: string): string {
  return `<p style="margin:18px 0"><a href="${url}" style="background:#5B6EF5;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px;display:inline-block">Verify my email</a></p>
<p style="color:#888;font-size:13px">Or type the code above in the app. The button and the code both work for ${VERIFY_CODE_HOURS} hours.</p>`;
}
