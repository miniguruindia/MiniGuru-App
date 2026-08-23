// STOPGAP (Aug 2026): same Resend/SendGrid dual-transport as the sibling
// services/emailService.ts — see that file's header comment for the full
// reasoning (SendGrid Consumer Trust review, Ticket #29128948). If
// RESEND_API_KEY is set, sends go through Resend; otherwise, behavior is
// unchanged (SendGrid). All existing exports kept identical so nothing
// that imports this file needs to change.
import sgMail from '@sendgrid/mail';

let resendClient: any = null;
if (process.env.RESEND_API_KEY) {
  const { Resend } = require('resend');
  resendClient = new Resend(process.env.RESEND_API_KEY);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const DEFAULT_FROM = { email: process.env.FROM_EMAIL || 'connect@miniguru.in', name: 'MiniGuru' };
// Second, lower-stakes "official" sender — for materials-kit-to-parent
// emails and admin broadcasts/announcements. connect@miniguru.in stays
// reserved for OTP codes and password resets (highest-stakes, most
// security-sensitive mail). Requires miniguru.in@gmail.com to be a
// verified sender identity with whichever provider is currently active
// (SendGrid or Resend) — mail from an unverified sender is silently
// rejected or spam-flagged, so confirm that's done before relying on this.
export const OFFICIAL_FROM = { email: 'miniguru.in@gmail.com', name: 'MiniGuru' };

export async function sendEmail({
  to,
  subject,
  html,
  fromOverride,
}: {
  to: string;
  subject: string;
  html: string;
  fromOverride?: { email: string; name: string };
}) {
  const from = fromOverride || DEFAULT_FROM;

  if (resendClient) {
    const { error } = await resendClient.emails.send({
      from: `${from.name} <${from.email}>`,
      to: [to],
      subject,
      html,
    });
    if (error) {
      throw new Error(`Resend send failed: ${error.message || JSON.stringify(error)}`);
    }
    return;
  }

  await sgMail.send({ to, from, subject, html });
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await sendEmail({
    to,
    subject: 'Reset your MiniGuru password',
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#F5F7FF;border-radius:16px;">
      <h1 style="color:#5B6EF5;text-align:center">MiniGuru</h1>
      <h2>Reset your password</h2>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetUrl}" style="background:#5B6EF5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
      </div>
      <p style="color:#888;font-size:13px">If you did not request this, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #E8EAF6;margin:24px 0"/>
      <p style="color:#aaa;font-size:12px;text-align:center">MiniGuru Innovation Pvt Ltd, Ujjain MP</p>
    </div>`,
  });
}

export async function initializeEmailService() {
  if (resendClient) {
    console.log('✅ Email service ready (Resend)');
    return;
  }
  if (!process.env.SENDGRID_API_KEY) {
    console.log('⚠️  Email service error: neither RESEND_API_KEY nor SENDGRID_API_KEY is set');
    return;
  }
  console.log('✅ Email service ready (SendGrid)');
}

export default { sendEmail, sendPasswordResetEmail, initializeEmailService };
