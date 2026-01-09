import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter only if email is enabled
let transporter: nodemailer.Transporter | null = null;

// Check if email should be enabled
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false';

if (EMAIL_ENABLED) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Verify connection asynchronously without blocking
    transporter.verify((error, success) => {
      if (error) {
        console.log('⚠️  Email service error:', error.message);
        console.log('⚠️  Email service will be disabled. Server continues running.');
      } else {
        console.log('✅ Email service ready');
      }
    });
  } catch (error) {
    console.log('⚠️  Email service initialization failed:', error);
    transporter = null;
  }
} else {
  console.log('ℹ️  Email service disabled (EMAIL_ENABLED=false)');
}

export const sendPasswordResetEmail = async (
  to: string,
  resetToken: string
) => {
  // Check if email service is available
  if (!transporter) {
    console.log('⚠️  Email service not available, skipping password reset email');
    return false;
  }

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: `"MiniGuru Admin" <${process.env.FROM_EMAIL}>`,
    to: to,
    subject: 'Password Reset Request - MiniGuru Admin',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You have requested to reset your password for your MiniGuru Admin account.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px;">
              ${resetUrl}
            </p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} MiniGuru. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // Don't throw - just log and return false
    return false;
  }
};

export default {
  sendPasswordResetEmail,
};