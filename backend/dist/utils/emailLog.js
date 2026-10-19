"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEmail = logEmail;
// backend/src/utils/emailLog.ts
// Writes one EmailLog row per email attempt. Never throws: a logging problem must
// never stop (or be mistaken for) a real email.
const prismaClient_1 = __importDefault(require("./prismaClient"));
async function logEmail(toEmail, subject, status, error) {
    try {
        await prismaClient_1.default.emailLog.create({
            data: { toEmail: String(toEmail || '').slice(0, 200), subject: String(subject || '').slice(0, 200), status, error: error ? String(error).slice(0, 300) : null },
        });
        // Housekeeping: now and then drop rows older than 90 days.
        if (Math.random() < 0.02) {
            await prismaClient_1.default.emailLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86400000) } } });
        }
    }
    catch (e) {
        console.error('logEmail failed (email itself unaffected):', e?.message || e);
    }
}
