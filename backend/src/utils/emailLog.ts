// backend/src/utils/emailLog.ts
// Writes one EmailLog row per email attempt, and keeps a lasting list of the
// addresses MiniGuru has written to (EmailContact). Never throws: a logging
// problem must never stop (or be mistaken for) a real email.
//
// Keeping rules (admin > Communication > Sent emails):
//  * an email is shown as "fresh" for 8 days;
//  * on day 8 it moves to "Going to be deleted" with a warning;
//  * on day 15 it is deleted, unless the admin pressed Save (then it stays).
//  * the address + short reason (EmailContact) is never deleted.
//  * the body of codes / password-reset mail is NEVER stored.
import prisma from './prismaClient';

export const FRESH_DAYS = 8;
export const DELETE_AFTER_DAYS = 15;

export interface EmailMeta {
  html?: string;
  from?: string;
  kind?: string;
  reference?: string;
}

// Mail that carries a secret (a code or a reset link) is recognised by its subject
// when the sender did not say what it is.
const SECURITY_SUBJECT = /verif|reset your|password|\bcode\b|\botp\b/i;

function decideKind(subject: string, kind?: string): string {
  if (kind) return kind;
  return SECURITY_SUBJECT.test(subject || '') ? 'security' : 'other';
}

function defaultReference(kind: string, subject: string): string {
  if (kind === 'security') return 'Sign-up / verification / password mail';
  return String(subject || '').slice(0, 120);
}

export async function logEmail(toEmail: string, subject: string, status: 'sent' | 'failed' | 'blocked', error?: string, meta?: EmailMeta) {
  try {
    const db: any = prisma;
    const to = String(toEmail || '').trim();
    const kind = decideKind(subject, meta?.kind);
    const reference = String(meta?.reference || defaultReference(kind, subject)).slice(0, 200);
    const keepBody = kind !== 'security' && kind !== 'forward' && !!meta?.html;
    await db.emailLog.create({
      data: {
        toEmail: to.slice(0, 200),
        subject: String(subject || '').slice(0, 200),
        status,
        error: error ? String(error).slice(0, 300) : null,
        fromEmail: meta?.from ? String(meta.from).slice(0, 200) : null,
        kind,
        reference,
        bodyHtml: keepBody ? String(meta!.html).slice(0, 60000) : null,
      },
    });

    // Lasting address book (only for mail that really went out).
    if (status === 'sent' && kind !== 'forward' && to) {
      const email = to.toLowerCase();
      const existing = await db.emailContact.findUnique({ where: { email } });
      if (existing) {
        await db.emailContact.update({
          where: { email },
          data: { sentCount: (existing.sentCount || 0) + 1, lastSentAt: new Date(), lastKind: kind, lastReference: reference },
        });
      } else {
        await db.emailContact.create({ data: { email, lastKind: kind, lastReference: reference } });
      }
    }

    // Housekeeping: now and then remove unsaved emails past their time.
    if (Math.random() < 0.05) await purgeOldEmails();
  } catch (e: any) {
    console.error('logEmail failed (email itself unaffected):', e?.message || e);
  }
}

// Deletes unsaved emails older than DELETE_AFTER_DAYS. Saved ones stay.
export async function purgeOldEmails(): Promise<number> {
  try {
    const db: any = prisma;
    const cutoff = new Date(Date.now() - DELETE_AFTER_DAYS * 86400000);
    const old = await db.emailLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, saved: true },
      take: 2000,
    });
    const ids = old.filter((r: any) => r.saved !== true).map((r: any) => r.id);
    if (ids.length) await db.emailLog.deleteMany({ where: { id: { in: ids } } });
    return ids.length;
  } catch (e: any) {
    console.error('purgeOldEmails failed:', e?.message || e);
    return 0;
  }
}
