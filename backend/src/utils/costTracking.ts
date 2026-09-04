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

import prisma from './prismaClient';
import { getBucketTotalSizeBytes } from '../services/firebaseStorageService';

// ── Email (Resend, currently active) ───────────────────────────────────────
// Resend's real free-tier cap is 100/day, 3,000/month. We stop 5 short of
// that (95) so there's always a safety margin — a burst of a few emails
// landing at the exact same moment as our own counter check should never be
// able to push the account over Resend's actual hard limit.
const EMAIL_QUOTA_KEY = 'email_send_quota';
export const EMAIL_DAILY_LIMIT = 100;
export const EMAIL_DAILY_CUTOFF = 95;
export const EMAIL_MONTHLY_LIMIT = 3000;

// ── YouTube Data API v3 ──────────────────────────────────────────────────
// Real quota is enforced entirely on Google's side — this is OUR OWN
// best-effort estimate of unit cost per call type, so the dashboard has
// something to show. Not authoritative; Google's own Cloud Console quota
// page is the source of truth if these ever disagree.
const YOUTUBE_QUOTA_KEY = 'youtube_quota_estimate';
export const YOUTUBE_DAILY_LIMIT = 10000; // update if/when Google approves the increase request
export const YOUTUBE_UNIT_COSTS = {
  upload: 1600,
  update: 50,
  comment: 50,
  list: 1,
} as const;

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
export const FIREBASE_STORAGE_LIMIT_GB = 5;

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function readDailyCounter(key: string): Promise<{ date: string; count: number }> {
  try {
    const existing = await prisma.siteContent.findUnique({ where: { key } });
    const data = (existing?.value as any) ?? { date: today(), count: 0 };
    if (data.date !== today()) return { date: today(), count: 0 };
    return data;
  } catch {
    return { date: today(), count: 0 };
  }
}

async function writeDailyCounter(key: string, data: { date: string; count: number }): Promise<void> {
  try {
    await prisma.siteContent.upsert({
      where: { key },
      update: { value: data },
      create: { key, value: data },
    });
  } catch {
    // Never let the tracker itself block the real action it's tracking.
  }
}

// ── Email quota ──────────────────────────────────────────────────────────

/** Call BEFORE attempting a send. Never throws — a tracker failure should
 * never itself block a real email; it fails open (returns allowed: true). */
export async function checkEmailQuota(): Promise<{ allowed: boolean; sentToday: number }> {
  const data = await readDailyCounter(EMAIL_QUOTA_KEY);
  return { allowed: data.count < EMAIL_DAILY_CUTOFF, sentToday: data.count };
}

/** Call AFTER a send genuinely succeeds. */
export async function recordEmailSent(): Promise<void> {
  const data = await readDailyCounter(EMAIL_QUOTA_KEY);
  data.count += 1;
  await writeDailyCounter(EMAIL_QUOTA_KEY, data);
}

// ── YouTube quota (best-effort estimate) ────────────────────────────────

export async function recordYoutubeUnits(units: number): Promise<void> {
  const data = await readDailyCounter(YOUTUBE_QUOTA_KEY);
  data.count += units;
  await writeDailyCounter(YOUTUBE_QUOTA_KEY, data);
}

async function getYoutubeQuotaStatus() {
  const data = await readDailyCounter(YOUTUBE_QUOTA_KEY);
  return { estimatedUnitsToday: data.count, dailyLimit: YOUTUBE_DAILY_LIMIT, authoritative: false };
}

// ── Gemini quota (read-only mirror of aiVideoReviewService's own counter)

async function getGeminiQuotaStatus() {
  const data = await readDailyCounter(GEMINI_QUOTA_KEY);
  return { callsToday: data.count };
}

// ── Amazon Creators API (search + getItems calls) ────────────────────────

export async function recordAmazonApiCall(): Promise<void> {
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
    const stats: any = await prisma.$runCommandRaw({ dbStats: 1 });
    const usedMB = stats?.storageSize != null ? Math.round((stats.storageSize / (1024 * 1024)) * 10) / 10 : null;
    return { usedMB, limitMB: 512, checkedLive: true };
  } catch {
    return { usedMB: null, limitMB: 512, checkedLive: false };
  }
}

// ── Firebase Storage — real, but cached (listing every file is not free
// to do on every dashboard refresh)

async function getFirebaseStorageStatus() {
  try {
    const cached = await prisma.siteContent.findUnique({ where: { key: FIREBASE_STORAGE_CACHE_KEY } });
    const cachedData = cached?.value as any;
    if (cachedData && Date.now() - cachedData.checkedAt < FIREBASE_STORAGE_CACHE_TTL_MS) {
      return { usedGB: cachedData.usedGB, limitGB: FIREBASE_STORAGE_LIMIT_GB, cached: true };
    }
    const bytes = await getBucketTotalSizeBytes();
    const usedGB = Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
    await writeDailyCounter(FIREBASE_STORAGE_CACHE_KEY, { date: today(), count: 0 } as any);
    await prisma.siteContent.upsert({
      where: { key: FIREBASE_STORAGE_CACHE_KEY },
      update: { value: { usedGB, checkedAt: Date.now() } },
      create: { key: FIREBASE_STORAGE_CACHE_KEY, value: { usedGB, checkedAt: Date.now() } },
    });
    return { usedGB, limitGB: FIREBASE_STORAGE_LIMIT_GB, cached: false };
  } catch {
    return { usedGB: null, limitGB: FIREBASE_STORAGE_LIMIT_GB, cached: false, error: 'Could not reach Firebase Storage' };
  }
}

// ── Full dashboard snapshot ──────────────────────────────────────────────

export async function getCostDashboardSnapshot() {
  const [email, gemini, youtube, mongo, firebase, amazon] = await Promise.all([
    checkEmailQuota(),
    getGeminiQuotaStatus(),
    getYoutubeQuotaStatus(),
    getMongoStorageStatus(),
    getFirebaseStorageStatus(),
    getAmazonQuotaStatus(),
  ]);

  return {
    email: {
      provider: 'resend',
      sentToday: email.sentToday,
      dailyLimit: EMAIL_DAILY_LIMIT,
      cutoffAt: EMAIL_DAILY_CUTOFF,
      monthlyLimit: EMAIL_MONTHLY_LIMIT,
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
    amazon: {
      callsToday: amazon.callsToday,
      note: 'Best-effort call count from our own tracker — Amazon does not expose a live quota-remaining figure. Rate limit scales automatically with trailing-30-day affiliate revenue.',
    },
    gcpConsoleOnly: {
      note: 'Cloud Run request volume and Artifact Registry storage cost are only visible via the GCP Billing console — not trackable from application code. Check Cloud Console → Billing → Reports periodically.',
    },
  };
}
