"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE_AFTER_DAYS = exports.FRESH_DAYS = void 0;
exports.logEmail = logEmail;
exports.purgeOldEmails = purgeOldEmails;
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
const prismaClient_1 = __importDefault(require("./prismaClient"));
exports.FRESH_DAYS = 8;
exports.DELETE_AFTER_DAYS = 15;
// Mail that carries a secret (a code or a reset link) is recognised by its subject
// when the sender did not say what it is.
const SECURITY_SUBJECT = /verif|reset your|password|\bcode\b|\botp\b/i;
function decideKind(subject, kind) {
    if (kind)
        return kind;
    return SECURITY_SUBJECT.test(subject || '') ? 'security' : 'other';
}
function defaultReference(kind, subject) {
    if (kind === 'security')
        return 'Sign-up / verification / password mail';
    return String(subject || '').slice(0, 120);
}
async function logEmail(toEmail, subject, status, error, meta) {
    try {
        const db = prismaClient_1.default;
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
                bodyHtml: keepBody ? String(meta.html).slice(0, 60000) : null,
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
            }
            else {
                await db.emailContact.create({ data: { email, lastKind: kind, lastReference: reference } });
            }
        }
        // Housekeeping: now and then remove unsaved emails past their time.
        if (Math.random() < 0.05)
            await purgeOldEmails();
    }
    catch (e) {
        console.error('logEmail failed (email itself unaffected):', e?.message || e);
    }
}
// Deletes unsaved emails older than DELETE_AFTER_DAYS. Saved ones stay.
async function purgeOldEmails() {
    try {
        const db = prismaClient_1.default;
        const cutoff = new Date(Date.now() - exports.DELETE_AFTER_DAYS * 86400000);
        const old = await db.emailLog.findMany({
            where: { createdAt: { lt: cutoff } },
            select: { id: true, saved: true },
            take: 2000,
        });
        const ids = old.filter((r) => r.saved !== true).map((r) => r.id);
        if (ids.length)
            await db.emailLog.deleteMany({ where: { id: { in: ids } } });
        return ids.length;
    }
    catch (e) {
        console.error('purgeOldEmails failed:', e?.message || e);
        return 0;
    }
}
