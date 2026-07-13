"use strict";
// backend/src/services/notificationService.ts
//
// In-app notifications — the replacement for email everywhere email isn't
// strictly required. Email stays ONLY for: literal OTP codes, password
// reset (the person is locked out, can't see in-app anything), and
// messages to someone with no MiniGuru login at all (shop send-to-parent,
// the public contact form). Everything else — admin broadcasts, AI-review
// alerts, announcements — writes here instead.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUser = notifyUser;
exports.notifyManyUsers = notifyManyUsers;
exports.notifyAllAdmins = notifyAllAdmins;
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
async function notifyUser(params) {
    const { userId, type, message, emoji, link } = params;
    return prismaClient_1.default.notification.create({
        data: { userId, type, message, emoji: emoji ?? '🔔', link: link ?? null },
    });
}
/**
 * Notify many users at once (e.g. an admin broadcast to every student).
 * Uses createMany for efficiency — no email involved at all, so there's no
 * per-recipient quota to worry about, unlike the old SendGrid broadcast.
 */
async function notifyManyUsers(params) {
    const { userIds, type, message, emoji, link } = params;
    if (userIds.length === 0)
        return { count: 0 };
    return prismaClient_1.default.notification.createMany({
        data: userIds.map((userId) => ({
            userId,
            type,
            message,
            emoji: emoji ?? '🔔',
            link: link ?? null,
        })),
    });
}
/** Notify every current ADMIN — used for AI-review UNSURE alerts etc. */
async function notifyAllAdmins(params) {
    const admins = await prismaClient_1.default.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    return notifyManyUsers({ userIds: admins.map((a) => a.id), ...params });
}
