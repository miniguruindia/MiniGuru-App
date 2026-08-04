// backend/src/services/dailyQuestService.ts
//
// Real Daily Quest (Aug 2026). Replaces a purely decorative home-screen
// card that always showed "3/5 • +50 pts" — hardcoded, never actually
// tracked anything, for anyone.
//
// Task: watch DAILY_QUEST_TARGET project videos to real completion in a
// day. Reuses the EXISTING 75%-watched view-tracking (trackVideoView) —
// no separate counting system, no new exploit surface. Reward is a flat
// Goins bonus on completion, plus a login/completion streak that resets if
// a day is missed. Both numbers below are the only things to touch if this
// needs tuning later — kept simple on purpose per the founder's request to
// "start simple and adjust later."

import prisma from "../utils/prismaClient";
import logger from "../logger";

export const DAILY_QUEST_TARGET = 3; // videos watched to completion
export const DAILY_QUEST_REWARD = 10; // flat Goins on completion

function todayString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" (UTC)
}
function yesterdayString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function getOrCreateTodayQuest(userId: string) {
  const today = todayString();
  const existing = await prisma.dailyQuestProgress.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (existing) return existing;

  return prisma.dailyQuestProgress.create({
    data: { userId, date: today, videosWatched: 0, completed: false },
  });
}

// Called from trackVideoView, right after a real (75%+ watched) view is
// credited. Never throws — a quest-tracking hiccup must never break video
// view tracking itself.
export async function recordQuestVideoWatched(userId: string) {
  try {
    const today = todayString();
    const progress = await getOrCreateTodayQuest(userId);
    if (progress.completed) return; // already done today

    const newCount = progress.videosWatched + 1;
    const justCompleted = newCount >= DAILY_QUEST_TARGET;

    if (!justCompleted) {
      await prisma.dailyQuestProgress.update({
        where: { userId_date: { userId, date: today } },
        data: { videosWatched: newCount },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, lastQuestDate: true },
    });

    // Streak continues only if the LAST completed day was exactly
    // yesterday. Missed a day (or first time ever) → restart at 1.
    const newStreak = user?.lastQuestDate === yesterdayString() ? (user.currentStreak ?? 0) + 1 : 1;

    await prisma.$transaction([
      prisma.dailyQuestProgress.update({
        where: { userId_date: { userId, date: today } },
        data: { videosWatched: newCount, completed: true, streakAtCompletion: newStreak },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          score: { increment: DAILY_QUEST_REWARD },
          currentStreak: newStreak,
          lastQuestDate: today,
          scoreHistory: {
            push: {
              time: new Date(),
              updatedScore: DAILY_QUEST_REWARD,
              reason: `Daily Quest complete (day ${newStreak} streak): +${DAILY_QUEST_REWARD} Goins`,
            },
          },
        },
      }),
    ]);

    logger.info(`🎯 Daily Quest completed by ${userId} — streak now ${newStreak}`);
  } catch (e) {
    logger.warn({ e }, "⚠️ Daily Quest tracking failed — the view itself still counted normally");
  }
}
