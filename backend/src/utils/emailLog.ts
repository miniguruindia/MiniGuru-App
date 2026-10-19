// backend/src/utils/emailLog.ts
// Writes one EmailLog row per email attempt. Never throws: a logging problem must
// never stop (or be mistaken for) a real email.
import prisma from './prismaClient';

export async function logEmail(toEmail: string, subject: string, status: 'sent' | 'failed' | 'blocked', error?: string) {
  try {
    await (prisma as any).emailLog.create({
      data: { toEmail: String(toEmail || '').slice(0, 200), subject: String(subject || '').slice(0, 200), status, error: error ? String(error).slice(0, 300) : null },
    });
    // Housekeeping: now and then drop rows older than 90 days.
    if (Math.random() < 0.02) {
      await (prisma as any).emailLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86400000) } } });
    }
  } catch (e: any) {
    console.error('logEmail failed (email itself unaffected):', e?.message || e);
  }
}
