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
exports.SHOP_AI_PER_USER_DAILY = exports.SHOP_AI_DAILY_CAP = exports.PHONE_SMS_PER_USER_DAILY = exports.PHONE_SMS_DAILY_CAP = exports.FIREBASE_STORAGE_LIMIT_GB = exports.YOUTUBE_UPLOAD_DAILY_LIMIT = exports.YOUTUBE_UNIT_COSTS = exports.YOUTUBE_DAILY_LIMIT = exports.EMAIL_MONTHLY_LIMIT = exports.EMAIL_DAILY_CUTOFF = exports.EMAIL_DAILY_LIMIT = void 0;
exports.checkEmailQuota = checkEmailQuota;
exports.recordEmailSent = recordEmailSent;
exports.recordYoutubeUnits = recordYoutubeUnits;
exports.recordYoutubeUpload = recordYoutubeUpload;
exports.recordAmazonApiCall = recordAmazonApiCall;
exports.checkPhoneSmsQuota = checkPhoneSmsQuota;
exports.recordPhoneSmsStarted = recordPhoneSmsStarted;
exports.recordPhoneVerified = recordPhoneVerified;
exports.checkShopAiQuota = checkShopAiQuota;
exports.recordShopAiSearch = recordShopAiSearch;
exports.getCostDashboardSnapshot = getCostDashboardSnapshot;
const prismaClient_1 = __importDefault(require("./prismaClient"));
const firebaseStorageService_1 = require("../services/firebaseStorageService");
const phoneVerification_1 = require("../services/phoneVerification");
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
//
// CORRECTED (Sept 2026) — Google's current cost table (developers.google.
// com/youtube/v3/determine_quota_cost, confirmed live) has TWO independent
// buckets, not one:
//   1. videos.insert (upload) — its OWN separate daily bucket, cost 1 per
//      call. Default allocation is 100/day; MiniGuru requested an increase
//      (200/day) — update YOUTUBE_UPLOAD_DAILY_LIMIT below once Google
//      confirms the actual granted number.
//   2. Everything else (videos.update, videos.delete, videos.rate,
//      commentThreads.insert, videos.list, etc.) — a SHARED 10,000/day
//      pool, unchanged from before.
// The old model here charged 1600 units per upload against the shared
// pool — that was the PRE-June-2026 methodology and was wrong under the
// current rules; it made the dashboard look like it was blowing through
// quota on days that, under Google's real accounting, were nowhere close
// (confirmed live: 13 real uploads in one day, all succeeded with zero
// quota errors — 13 units against a 100+/day upload bucket is trivial).
const YOUTUBE_QUOTA_KEY = 'youtube_quota_estimate';
exports.YOUTUBE_DAILY_LIMIT = 10000; // shared pool — everything EXCEPT uploads
exports.YOUTUBE_UNIT_COSTS = {
    // upload intentionally NOT here — it never touches this shared pool,
    // see recordYoutubeUpload() / YOUTUBE_UPLOAD_QUOTA_KEY below instead.
    update: 50,
    comment: 50,
    list: 1,
};
const YOUTUBE_UPLOAD_QUOTA_KEY = 'youtube_upload_quota_estimate';
exports.YOUTUBE_UPLOAD_DAILY_LIMIT = 100; // Google's default for videos.insert's own bucket — raise this once a confirmed higher grant is in hand
// ── Gemini AI review — read-only here, aiVideoReviewService.ts owns writes
const GEMINI_QUOTA_KEY = 'ai_review_quota';
// ── Amazon Creators API ──────────────────────────────────────────────────
// Amazon's real rate limit for Creators API is tied to trailing-30-day
// affiliate revenue and isn't exposed via a simple header we can read —
// this is just OUR OWN call-count tracker so the dashboard shows usage
// trends, not an authoritative "X remaining" figure.
const AMAZON_QUOTA_KEY = 'amazon_creators_api_calls';
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
/** Call AFTER a real videos.insert (upload) call succeeds. Its own separate
 * 1-unit-per-call bucket — never mixed into the shared 10,000/day pool. */
async function recordYoutubeUpload() {
    const data = await readDailyCounter(YOUTUBE_UPLOAD_QUOTA_KEY);
    data.count += 1;
    await writeDailyCounter(YOUTUBE_UPLOAD_QUOTA_KEY, data);
}
async function getYoutubeUploadQuotaStatus() {
    const data = await readDailyCounter(YOUTUBE_UPLOAD_QUOTA_KEY);
    return { uploadsToday: data.count, dailyLimit: exports.YOUTUBE_UPLOAD_DAILY_LIMIT, authoritative: false };
}
// ── Gemini quota (read-only mirror of aiVideoReviewService's own counter)
async function getGeminiQuotaStatus() {
    const data = await readDailyCounter(GEMINI_QUOTA_KEY);
    return { callsToday: data.count };
}
// ── Amazon Creators API (search + getItems calls) ────────────────────────
async function recordAmazonApiCall() {
    const data = await readDailyCounter(AMAZON_QUOTA_KEY);
    data.count += 1;
    await writeDailyCounter(AMAZON_QUOTA_KEY, data);
}
async function getAmazonQuotaStatus() {
    const data = await readDailyCounter(AMAZON_QUOTA_KEY);
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
// ── Phone verification (Firebase Phone Auth SMS, MSG91 later) ────────────
// Each "start" is one SMS the provider will send — the thing that can cost
// money. We count starts (not just successes) because a failed attempt still
// sends the text. Hard caps protect the bill: a daily cap for the whole site
// and a small daily cap per account, so one person can't burn everyone's
// allowance. The estimated rupee cost uses PHONE_SMS_EST_RATE_INR, which is
// deliberately NOT guessed here — set it from the Firebase/Google price list.
const PHONE_STARTED_KEY = 'phone_sms_started_quota';
const PHONE_VERIFIED_KEY = 'phone_verified_quota';
exports.PHONE_SMS_DAILY_CAP = Math.max(1, parseInt(process.env.PHONE_SMS_DAILY_CAP || '50', 10) || 50);
exports.PHONE_SMS_PER_USER_DAILY = 5;
function monthId() {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
}
async function readPeriodCounter(key, period) {
    try {
        const existing = await prismaClient_1.default.siteContent.findUnique({ where: { key } });
        const data = existing?.value ?? { date: period, count: 0 };
        return data.date === period ? data : { date: period, count: 0 };
    }
    catch {
        return { date: period, count: 0 };
    }
}
/** Call BEFORE starting a phone verification. Fails open if the tracker itself errors. */
async function checkPhoneSmsQuota(userId) {
    const site = await readDailyCounter(PHONE_STARTED_KEY);
    if (site.count >= exports.PHONE_SMS_DAILY_CAP)
        return { allowed: false, reason: 'site', startedToday: site.count };
    const user = await readDailyCounter(`phone_sms_user_${userId}`);
    if (user.count >= exports.PHONE_SMS_PER_USER_DAILY)
        return { allowed: false, reason: 'user', startedToday: site.count };
    return { allowed: true, startedToday: site.count };
}
/** Call when an SMS is about to be sent (one call = one SMS). */
async function recordPhoneSmsStarted(userId) {
    const day = await readDailyCounter(PHONE_STARTED_KEY);
    day.count += 1;
    await writeDailyCounter(PHONE_STARTED_KEY, day);
    const user = await readDailyCounter(`phone_sms_user_${userId}`);
    user.count += 1;
    await writeDailyCounter(`phone_sms_user_${userId}`, user);
    const month = await readPeriodCounter(`phone_sms_month_${monthId()}`, monthId());
    month.count += 1;
    await writeDailyCounter(`phone_sms_month_${monthId()}`, month);
}
async function recordPhoneVerified() {
    const data = await readDailyCounter(PHONE_VERIFIED_KEY);
    data.count += 1;
    await writeDailyCounter(PHONE_VERIFIED_KEY, data);
}
async function getPhoneAuthStatus() {
    const provider = (0, phoneVerification_1.getPhoneProvider)();
    const [started, verified, month] = await Promise.all([
        readDailyCounter(PHONE_STARTED_KEY),
        readDailyCounter(PHONE_VERIFIED_KEY),
        readPeriodCounter(`phone_sms_month_${monthId()}`, monthId()),
    ]);
    const rateRaw = parseFloat(process.env.PHONE_SMS_EST_RATE_INR || '');
    const rate = Number.isFinite(rateRaw) && rateRaw >= 0 ? rateRaw : null;
    return {
        provider: provider.name,
        configured: provider.isConfigured(),
        startedToday: started.count,
        verifiedToday: verified.count,
        dailyCap: exports.PHONE_SMS_DAILY_CAP,
        startedThisMonth: month.count,
        estRatePerSmsInr: rate,
        estCostThisMonthInr: rate == null ? null : Math.round(month.count * rate * 100) / 100,
        note: 'Counts every SMS we allow to start (failed attempts still send a text). Rupee estimate = SMS count x PHONE_SMS_EST_RATE_INR; ' +
            'the real charge is on the Google Cloud / Firebase bill, which is the source of truth.',
    };
}
// ── Shop AI search (Gemini, free no-billing project) ─────────────────────
// Own daily caps so it can never eat the video-review allowance: one for the
// whole site and a small one per account.
const SHOP_AI_KEY = 'shop_ai_search_quota';
exports.SHOP_AI_DAILY_CAP = Math.max(1, parseInt(process.env.SHOP_AI_SEARCH_DAILY_CAP || '150', 10) || 150);
exports.SHOP_AI_PER_USER_DAILY = 10;
async function checkShopAiQuota(userId) {
    const site = await readDailyCounter(SHOP_AI_KEY);
    if (site.count >= exports.SHOP_AI_DAILY_CAP)
        return { allowed: false, reason: 'site' };
    const user = await readDailyCounter(`shop_ai_user_${userId}`);
    if (user.count >= exports.SHOP_AI_PER_USER_DAILY)
        return { allowed: false, reason: 'user' };
    return { allowed: true };
}
async function recordShopAiSearch(userId) {
    const site = await readDailyCounter(SHOP_AI_KEY);
    site.count += 1;
    await writeDailyCounter(SHOP_AI_KEY, site);
    const user = await readDailyCounter(`shop_ai_user_${userId}`);
    user.count += 1;
    await writeDailyCounter(`shop_ai_user_${userId}`, user);
}
async function getShopAiStatus() {
    const site = await readDailyCounter(SHOP_AI_KEY);
    return {
        callsToday: site.count,
        dailyCap: exports.SHOP_AI_DAILY_CAP,
        note: 'Name and photo search in the Shop. Own cap, so it never uses the video-review allowance. Photos are never stored.',
    };
}
// ── Full dashboard snapshot ──────────────────────────────────────────────
async function getCostDashboardSnapshot() {
    const [email, gemini, youtube, youtubeUploads, mongo, firebase, amazon, phoneAuth, shopAi] = await Promise.all([
        checkEmailQuota(),
        getGeminiQuotaStatus(),
        getYoutubeQuotaStatus(),
        getYoutubeUploadQuotaStatus(),
        getMongoStorageStatus(),
        getFirebaseStorageStatus(),
        getAmazonQuotaStatus(),
        getPhoneAuthStatus(),
        getShopAiStatus(),
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
            // Two independent buckets — see the comment above YOUTUBE_UNIT_COSTS
            // for why they're separate. Combining them into one number is what
            // made the dashboard look wrong before (Sept 2026 fix).
            uploads: {
                uploadsToday: youtubeUploads.uploadsToday,
                dailyLimit: youtubeUploads.dailyLimit,
                label: 'Video uploads (videos.insert)',
            },
            otherCalls: {
                estimatedUnitsToday: youtube.estimatedUnitsToday,
                dailyLimit: youtube.dailyLimit,
                label: 'Everything else (update/comment/list/etc., shared pool)',
            },
            authoritative: false,
            note: 'Best-effort estimate from our own call counts — Google Cloud Console → YouTube Data API v3 → Quotas is the real source of truth.',
        },
        mongodb: mongo,
        firebaseStorage: firebase,
        amazon: {
            callsToday: amazon.callsToday,
            note: 'Best-effort call count from our own tracker — Amazon does not expose a live quota-remaining figure. Rate limit scales automatically with trailing-30-day affiliate revenue.',
        },
        phoneAuth,
        shopAi,
        gcpConsoleOnly: {
            note: 'Cloud Run request volume and Artifact Registry storage cost are only visible via the GCP Billing console — not trackable from application code. Check Cloud Console → Billing → Reports periodically.',
        },
    };
}
