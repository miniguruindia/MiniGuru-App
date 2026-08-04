"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_QUEST_REWARD = exports.DAILY_QUEST_TARGET = void 0;
exports.getOrCreateTodayQuest = getOrCreateTodayQuest;
exports.recordQuestVideoWatched = recordQuestVideoWatched;
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const logger_1 = __importDefault(require("../logger"));
exports.DAILY_QUEST_TARGET = 3; // videos watched to completion
exports.DAILY_QUEST_REWARD = 10; // flat Goins on completion
function todayString() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" (UTC)
}
function yesterdayString() {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}
async function getOrCreateTodayQuest(userId) {
    const today = todayString();
    const existing = await prismaClient_1.default.dailyQuestProgress.findUnique({
        where: { userId_date: { userId, date: today } },
    });
    if (existing)
        return existing;
    return prismaClient_1.default.dailyQuestProgress.create({
        data: { userId, date: today, videosWatched: 0, completed: false },
    });
}
// Called from trackVideoView, right after a real (75%+ watched) view is
// credited. Never throws — a quest-tracking hiccup must never break video
// view tracking itself.
async function recordQuestVideoWatched(userId) {
    try {
        const today = todayString();
        const progress = await getOrCreateTodayQuest(userId);
        if (progress.completed)
            return; // already done today
        const newCount = progress.videosWatched + 1;
        const justCompleted = newCount >= exports.DAILY_QUEST_TARGET;
        if (!justCompleted) {
            await prismaClient_1.default.dailyQuestProgress.update({
                where: { userId_date: { userId, date: today } },
                data: { videosWatched: newCount },
            });
            return;
        }
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            select: { currentStreak: true, lastQuestDate: true },
        });
        // Streak continues only if the LAST completed day was exactly
        // yesterday. Missed a day (or first time ever) → restart at 1.
        const newStreak = user?.lastQuestDate === yesterdayString() ? (user.currentStreak ?? 0) + 1 : 1;
        await prismaClient_1.default.$transaction([
            prismaClient_1.default.dailyQuestProgress.update({
                where: { userId_date: { userId, date: today } },
                data: { videosWatched: newCount, completed: true, streakAtCompletion: newStreak },
            }),
            prismaClient_1.default.user.update({
                where: { id: userId },
                data: {
                    score: { increment: exports.DAILY_QUEST_REWARD },
                    currentStreak: newStreak,
                    lastQuestDate: today,
                    scoreHistory: {
                        push: {
                            time: new Date(),
                            updatedScore: exports.DAILY_QUEST_REWARD,
                            reason: `Daily Quest complete (day ${newStreak} streak): +${exports.DAILY_QUEST_REWARD} Goins`,
                        },
                    },
                },
            }),
        ]);
        logger_1.default.info(`🎯 Daily Quest completed by ${userId} — streak now ${newStreak}`);
    }
    catch (e) {
        logger_1.default.warn({ e }, "⚠️ Daily Quest tracking failed — the view itself still counted normally");
    }
}
