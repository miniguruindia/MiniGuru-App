"use strict";
// backend/src/utils/costTracking.ts
//
// Shared daily-usage tracking for every free-tier ceiling this project
// depends on. Reuses the exact SiteContent JSON-blob pattern already
// proven for Gemini's ai_review_quota (aiVideoReviewService.ts) — no
// schema migration needed for any of the counters below.
//
// Two kinds of numbers here:
//  - LIVE counters (email, YouTube-units-estimate, Gemini) — incremented by
//    our own code on every real call, reset automatically at midnight
//    (date-keyed, same as ai_review_quota).
//  - POINT-IN-TIME checks (MongoDB storage, Firebase Storage) — these
//    can't be tracked incrementally the same way (nothing in our own code
//    "spends" storage per request the way it spends an email or a YouTube
//    call), so these are queried live when the dashboard loads, with a
//    short cache to avoid hammering Firebase's listFiles() on every
//    refresh.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIREBASE_STORAGE_LIMIT_GB = exports.YOUTUBE_UNIT_COSTS = exports.YOUTUBE_DAILY_LIMIT = exports.EMAIL_MONTHLY_LIMIT = exports.EMAIL_DAILY_CUTOFF = exports.EMAIL_DAILY_LIMIT = void 0;
exports.checkEmailQuota = checkEmailQuota;
exports.recordEmailSent = recordEmailSent;
exports.recordYoutubeUnits = recordYoutubeUnits;
exports.getCostDashboardSnapshot = getCostDashboardSnapshot;
const prismaClient_1 = __importDefault(require("./prismaClient"));
const firebaseStorageService_1 = require("../services/firebaseStorageService");
// ── Email (Resend, currently active) ───────────────────────────────────────
// Resend's real free-tier cap is 100/day, 3,000/month. We stop 5 short of
// that (95) so there's always a safety margin — a burst of a few emails
// landing at the exact same moment as our own counter check should never be
// able to push the account over Resend's actual hard limit.
const EMAIL_QUOTA_KEY = 'email_send_quota';
exports.EMAIL_DAILY_LIMIT = 100;
exports.EMAIL_DAILY_CUTOFF = 95;
exports.EMAIL_MONTHLY_LIMIT = 3000;
// ── YouTube Data API v3 ──────────────────────────────────────────────────
// Real quota is enforced entirely on Google's side — this is OUR OWN
// best-effort estimate of unit cost per call type, so the dashboard has
// something to show. Not authoritative; Google's own Cloud Console quota
// page is the source of truth if these ever disagree.
const YOUTUBE_QUOTA_KEY = 'youtube_quota_estimate';
exports.YOUTUBE_DAILY_LIMIT = 10000; // update if/when Google approves the increase request
exports.YOUTUBE_UNIT_COSTS = {
    upload: 1600,
    update: 50,
    comment: 50,
    list: 1,
};
// ── Gemini AI review — read-only here, aiVideoReviewService.ts owns writes
const GEMINI_QUOTA_KEY = 'ai_review_quota';
// ── Firebase Storage — cached point-in-time check
const FIREBASE_STORAGE_CACHE_KEY = 'firebase_storage_usage_cache';
const FIREBASE_STORAGE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
exports.FIREBASE_STORAGE_LIMIT_GB = 5;
function today() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
async function readDailyCounter(key) {
    try {
        const existing = await prismaClient_1.default.siteContent.findUnique({ where: { key } });
        const data = existing?.value ?? { date: today(), count: 0 };
        if (data.date !== today())
            return { date: today(), count: 0 };
        return data;
    }
    catch {
        return { date: today(), count: 0 };
    }
}
async function writeDailyCounter(key, data) {
    try {
        await prismaClient_1.default.siteContent.upsert({
            where: { key },
            update: { value: data },
            create: { key, value: data },
        });
    }
    catch {
        // Never let the tracker itself block the real action it's tracking.
    }
}
// ── Email quota ──────────────────────────────────────────────────────────
/** Call BEFORE attempting a send. Never throws — a tracker failure should
 * never itself block a real email; it fails open (returns allowed: true). */
async function checkEmailQuota() {
    const data = await readDailyCounter(EMAIL_QUOTA_KEY);
    return { allowed: data.count < exports.EMAIL_DAILY_CUTOFF, sentToday: data.count };
}
/** Call AFTER a send genuinely succeeds. */
async function recordEmailSent() {
    const data = await readDailyCounter(EMAIL_QUOTA_KEY);
    data.count += 1;
    await writeDailyCounter(EMAIL_QUOTA_KEY, data);
}
// ── YouTube quota (best-effort estimate) ────────────────────────────────
async function recordYoutubeUnits(units) {
    const data = await readDailyCounter(YOUTUBE_QUOTA_KEY);
    data.count += units;
    await writeDailyCounter(YOUTUBE_QUOTA_KEY, data);
}
async function getYoutubeQuotaStatus() {
    const data = await readDailyCounter(YOUTUBE_QUOTA_KEY);
    return { estimatedUnitsToday: data.count, dailyLimit: exports.YOUTUBE_DAILY_LIMIT, authoritative: false };
}
// ── Gemini quota (read-only mirror of aiVideoReviewService's own counter)
async function getGeminiQuotaStatus() {
    const data = await readDailyCounter(GEMINI_QUOTA_KEY);
    return { callsToday: data.count };
}
// ── MongoDB Atlas storage — real, live, cheap to query (no caching needed)
async function getMongoStorageStatus() {
    try {
        const stats = await prismaClient_1.default.$runCommandRaw({ dbStats: 1 });
        const usedMB = stats?.storageSize != null ? Math.round((stats.storageSize / (1024 * 1024)) * 10) / 10 : null;
        return { usedMB, limitMB: 512, checkedLive: true };
    }
    catch {
        return { usedMB: null, limitMB: 512, checkedLive: false };
    }
}
// ── Firebase Storage — real, but cached (listing every file is not free
// to do on every dashboard refresh)
async function getFirebaseStorageStatus() {
    try {
        const cached = await prismaClient_1.default.siteContent.findUnique({ where: { key: FIREBASE_STORAGE_CACHE_KEY } });
        const cachedData = cached?.value;
        if (cachedData && Date.now() - cachedData.checkedAt < FIREBASE_STORAGE_CACHE_TTL_MS) {
            return { usedGB: cachedData.usedGB, limitGB: exports.FIREBASE_STORAGE_LIMIT_GB, cached: true };
        }
        const bytes = await (0, firebaseStorageService_1.getBucketTotalSizeBytes)();
        const usedGB = Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
        await writeDailyCounter(FIREBASE_STORAGE_CACHE_KEY, { date: today(), count: 0 });
        await prismaClient_1.default.siteContent.upsert({
            where: { key: FIREBASE_STORAGE_CACHE_KEY },
            update: { value: { usedGB, checkedAt: Date.now() } },
            create: { key: FIREBASE_STORAGE_CACHE_KEY, value: { usedGB, checkedAt: Date.now() } },
        });
        return { usedGB, limitGB: exports.FIREBASE_STORAGE_LIMIT_GB, cached: false };
    }
    catch {
        return { usedGB: null, limitGB: exports.FIREBASE_STORAGE_LIMIT_GB, cached: false, error: 'Could not reach Firebase Storage' };
    }
}
// ── Full dashboard snapshot ──────────────────────────────────────────────
async function getCostDashboardSnapshot() {
    const [email, gemini, youtube, mongo, firebase] = await Promise.all([
        checkEmailQuota(),
        getGeminiQuotaStatus(),
        getYoutubeQuotaStatus(),
        getMongoStorageStatus(),
        getFirebaseStorageStatus(),
    ]);
    return {
        email: {
            provider: 'resend',
            sentToday: email.sentToday,
            dailyLimit: exports.EMAIL_DAILY_LIMIT,
            cutoffAt: exports.EMAIL_DAILY_CUTOFF,
            monthlyLimit: exports.EMAIL_MONTHLY_LIMIT,
            currentlyBlocked: !email.allowed,
        },
        gemini: {
            callsToday: gemini.callsToday,
            note: 'Runs in a separate, no-billing GCP project — always free tier, never bills.',
        },
        youtube: {
            estimatedUnitsToday: youtube.estimatedUnitsToday,
            dailyLimit: youtube.dailyLimit,
            authoritative: false,
            note: 'Best-effort estimate from our own call counts — Google Cloud Console → YouTube Data API v3 → Quotas is the real source of truth.',
        },
        mongodb: mongo,
        firebaseStorage: firebase,
        gcpConsoleOnly: {
            note: 'Cloud Run request volume and Artifact Registry storage cost are only visible via the GCP Billing console — not trackable from application code. Check Cloud Console → Billing → Reports periodically.',
        },
    };
}
