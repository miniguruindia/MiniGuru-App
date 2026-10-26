// STOPGAP (Aug 2026): same Resend/SendGrid dual-transport as the sibling
// services/emailService.ts — see that file's header comment for the full
// reasoning (SendGrid Consumer Trust review, Ticket #29128948). If
// RESEND_API_KEY is set, sends go through Resend; otherwise, behavior is
// unchanged (SendGrid). All existing exports kept identical so nothing
// that imports this file needs to change.
import sgMail from '@sendgrid/mail';
import { checkEmailQuota, recordEmailSent } from '../../utils/costTracking';
import { htmlToText } from '../../utils/htmlToText';

let resendClient: any = null;
if (process.env.RESEND_API_KEY) {
  const { Resend } = require('resend');
  resendClient = new Resend(process.env.RESEND_API_KEY);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const DEFAULT_FROM = { email: process.env.FROM_EMAIL || 'connect@miniguru.in', name: 'MiniGuru' };
// All MiniGuru mail now goes out from the one verified address connect@miniguru.in
// (Oct 2026: a second sender, updates@, was landing in Spam with a "might be
// dangerous" warning, and one sender builds a better reputation). OFFICIAL_FROM
// is kept as a name so existing callers still work; it is the same address.
export const OFFICIAL_FROM = DEFAULT_FROM;

async function sendEmailRaw({
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

  // Stop 5 short of Resend's real 100/day free-tier cap so a burst landing
  // at the same moment this check runs can never push the account over the
  // real hard limit. EMAIL_QUOTA_EXCEEDED is a recognizable marker callers
  // can check for (e.g. passwordResetController) to show a clear message
  // instead of a generic failure.
  const quota = await checkEmailQuota();
  if (!quota.allowed) {
    throw new Error(
      `EMAIL_QUOTA_EXCEEDED: Daily email limit reached (${quota.sentToday} sent today). ` +
      `Please try again tomorrow, or contact connect@miniguru.in directly.`
    );
  }

  if (resendClient) {
    const { error } = await resendClient.emails.send({
      from: `${from.name} <${from.email}>`,
      to: [to],
      subject,
      html,
      ...(htmlToText(html) ? { text: htmlToText(html) } : {}),
    });
    if (error) {
      throw new Error(`Resend send failed: ${error.message || JSON.stringify(error)}`);
    }
    await recordEmailSent();
    return;
  }

  await sgMail.send({ to, from, subject, html, ...(htmlToText(html) ? { text: htmlToText(html) } : {}) });
  await recordEmailSent();
}

function mailMeta(args: any) {
  const from = args?.fromOverride || DEFAULT_FROM;
  return { html: args?.html, from: from.email, kind: args?.kind, reference: args?.reference };
}

// Logs every attempt (sent / failed / blocked by the daily limit) for the admin Email log.
export async function sendEmail(args: any) {
  const { logEmail } = require('../../utils/emailLog');
  try {
    await sendEmailRaw(args);
    await logEmail(args.to, args.subject, 'sent', undefined, mailMeta(args));
  } catch (err: any) {
    const msg = String(err?.message || err);
    await logEmail(args.to, args.subject, msg.startsWith('EMAIL_QUOTA_EXCEEDED') ? 'blocked' : 'failed', msg, mailMeta(args));
    throw err;
  }
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
