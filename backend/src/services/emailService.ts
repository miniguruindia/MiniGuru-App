// backend/src/services/emailService.ts
// Replaces SMTP nodemailer with SendGrid HTTP API — works on Cloud Run

const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  await sgMail.send({
    to,
    from: {
      email: process.env.FROM_EMAIL || 'connect@miniguru.in',
      name: 'MiniGuru',
    },
    subject,
    html,
  });
}
