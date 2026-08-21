"use strict";
// backend/src/utils/levelSystem.ts
//
// Canonical Goins progression/level system. Before this file existed, the
// idea of a "level" was scattered across FOUR different, mutually
// inconsistent hardcoded definitions:
//   - community_screen.dart's _Level list (0/100/300/600/1000 thresholds)
//   - cmsRoutes.ts's default 'ladder' CMS content (SAME numbers, but with
//     "Inventor" and "Builder" swapped in order vs the Flutter list above —
//     never actually read by the app at all, pure dead config)
//   - userAnalyticsRoutes.ts's badges list (its own 300/600/900 thresholds)
//   - leaderboardRoutes.ts's inline emoji ternary (yet another 600 cutoff)
// None of them agreed with each other, and none of them matched how far
// Goins balances can actually run today (materials refunds, challenge
// bonuses, multi-child splits) — a genuinely active maker could clear the
// old "Innovator, 1000+" ceiling in a few sessions with nowhere further to
// climb. This file is now the ONE place level thresholds are defined;
// every consumer (leaderboard, badges, profile level card) imports from
// here instead of keeping its own copy.
//
// Requested band shape: each tier is 10x the previous (0–99, 100–999,
// 1000–9999, 10000–99999, ...) — wide enough that Goins growth from real
// usage keeps meaning something for a long time, with room to add more
// tiers later just by appending to this array.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEVELS = void 0;
exports.getLevelForScore = getLevelForScore;
exports.LEVELS = [
    { level: 1, title: 'Sprout', emoji: '🌱', minScore: 0, maxScore: 99 },
    { level: 2, title: 'Builder', emoji: '🔧', minScore: 100, maxScore: 999 },
    { level: 3, title: 'Engineer', emoji: '⚙️', minScore: 1000, maxScore: 9999 },
    { level: 4, title: 'Innovator', emoji: '🚀', minScore: 10000, maxScore: 99999 },
    { level: 5, title: 'Master Maker', emoji: '🏆', minScore: 100000, maxScore: 999999 },
    { level: 6, title: 'Legend', emoji: '🌟', minScore: 1000000, maxScore: null },
];
// A negative score (real, since Rule 25b allows material-cost debt) is
// always treated as Level 1 — never lets a level go negative or crash on
// an out-of-range lookup.
function getLevelForScore(score) {
    const safeScore = Math.max(0, score);
    const current = exports.LEVELS.find((l) => safeScore >= l.minScore && (l.maxScore === null || safeScore <= l.maxScore))
        ?? exports.LEVELS[exports.LEVELS.length - 1];
    const nextLevelAt = current.maxScore === null ? null : current.maxScore + 1;
    const goinsToNextLevel = nextLevelAt === null ? null : nextLevelAt - safeScore;
    const bandSize = current.maxScore === null ? 1 : current.maxScore - current.minScore + 1;
    const progressToNext = current.maxScore === null
        ? 1.0
        : Math.min(1.0, Math.max(0.0, (safeScore - current.minScore) / bandSize));
    return {
        level: current.level,
        title: current.title,
        emoji: current.emoji,
        minScore: current.minScore,
        maxScore: current.maxScore,
        nextLevelAt,
        goinsToNextLevel,
        progressToNext,
    };
}
