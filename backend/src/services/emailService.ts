// backend/src/services/emailService.ts
// Replaces SMTP nodemailer with SendGrid HTTP API — works on Cloud Run

const sgMail = require('@sendgrid/mail');

// BUGFIX (Aug 2026): was `sgMail.setApiKey(process.env.SENDGRID_API_KEY)`
// with no fallback and no missing-key guard — if the env var were ever
// undefined, this throws at MODULE LOAD TIME, not inside a try/catch,
// which would crash the whole import (and everything that imports this
// file) rather than failing one specific email send with a clear reason.
// Matches the safety guard already present in the sibling
// services/email/emailService.ts.
if (!process.env.SENDGRID_API_KEY) {
  console.log('⚠️  emailService.ts: SENDGRID_API_KEY not set — sendEmail() will fail until this is configured');
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function sendEmail({
  to,
  subject,
  html,
  cc,
}: {
  to: string;
  subject: string;
  html: string;
  cc?: string | string[];
}) {
  await sgMail.send({
    to,
    ...(cc ? { cc } : {}),
    from: {
      email: process.env.FROM_EMAIL || 'connect@miniguru.in',
      name: 'MiniGuru',
    },
    subject,
    html,
  });
}
