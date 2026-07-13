// backend/src/services/notificationService.ts
//
// In-app notifications — the replacement for email everywhere email isn't
// strictly required. Email stays ONLY for: literal OTP codes, password
// reset (the person is locked out, can't see in-app anything), and
// messages to someone with no MiniGuru login at all (shop send-to-parent,
// the public contact form). Everything else — admin broadcasts, AI-review
// alerts, announcements — writes here instead.

import prisma from '../utils/prismaClient';

export async function notifyUser(params: {
  userId: string;
  type: string;
  message: string;
  emoji?: string;
  link?: string;
}) {
  const { userId, type, message, emoji, link } = params;
  return prisma.notification.create({
    data: { userId, type, message, emoji: emoji ?? '🔔', link: link ?? null },
  });
}

/**
 * Notify many users at once (e.g. an admin broadcast to every student).
 * Uses createMany for efficiency — no email involved at all, so there's no
 * per-recipient quota to worry about, unlike the old SendGrid broadcast.
 */
export async function notifyManyUsers(params: {
  userIds: string[];
  type: string;
  message: string;
  emoji?: string;
  link?: string;
}) {
  const { userIds, type, message, emoji, link } = params;
  if (userIds.length === 0) return { count: 0 };
  return prisma.notification.createMany({
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
export async function notifyAllAdmins(params: { type: string; message: string; emoji?: string; link?: string }) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  return notifyManyUsers({ userIds: admins.map((a) => a.id), ...params });
}