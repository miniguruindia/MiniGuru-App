"use strict";
// backend/src/services/googleAnalyticsService.ts
//
// Website traffic (visits, users, top pages) for the admin Dashboard, via
// the real Google Analytics Data API (GA4) — not a placeholder/fake number.
//
// SETUP (two things needed, neither is code — do this in the GA4/Google
// Cloud console, then add the results as Cloud Run env vars):
//
// 1. GA4_PROPERTY_ID — the numeric Property ID for miniguru.in's GA4
//    property. Find it: analytics.google.com → Admin (gear icon) →
//    Property Settings → "Property ID" (a plain number like 123456789,
//    NOT the "G-XXXXXXX" Measurement ID — those are different things).
//
// 2. Credentials — reuses the SAME Firebase service account already in
//    Secret Manager (FIREBASE_SERVICE_ACCOUNT_JSON) rather than requiring
//    a brand new key. In Google Analytics: Admin → Property Access
//    Management → "+" → add the service account's email (the "client_email"
//    field inside that JSON, looks like
//    something@miniguru-prod.iam.gserviceaccount.com) as a Viewer. That's
//    it — no new JSON file, no new secret, just a permission grant.
//    (If a separate GA4-only service account is preferred instead, set
//    GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON to that JSON and it takes
//    priority over FIREBASE_SERVICE_ACCOUNT_JSON below.)
//
// Until GA4_PROPERTY_ID is set, isConfigured() returns false and the
// Dashboard shows setup instructions instead of a broken/fake chart.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isConfigured = isConfigured;
exports.getWebsiteAnalyticsSummary = getWebsiteAnalyticsSummary;
const data_1 = require("@google-analytics/data");
const logger_1 = __importDefault(require("../logger"));
function isConfigured() {
    return !!process.env.GA4_PROPERTY_ID && !!getCredentialsJson();
}
function getCredentialsJson() {
    return process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
}
let cachedClient = null;
function getClient() {
    if (cachedClient)
        return cachedClient;
    const raw = getCredentialsJson();
    if (!raw)
        return null;
    try {
        const credentials = JSON.parse(raw);
        cachedClient = new data_1.BetaAnalyticsDataClient({ credentials });
        return cachedClient;
    }
    catch (e) {
        logger_1.default.error({ e }, "❌ Could not parse Google Analytics credentials JSON");
        return null;
    }
}
// GA4 has no literal "all time" — we ask from a date safely before this
// property could have existed and let GA4 return whatever real data exists.
const ALL_TIME_START = '2020-01-01';
// Never throws — a GA4 hiccup should never take down the Dashboard. Returns
// configured:false with an error string on any failure, same "fail open,
// degrade gracefully" spirit as the rest of the Dashboard's stat fetches.
async function getWebsiteAnalyticsSummary() {
    if (!isConfigured())
        return { configured: false };
    const propertyId = process.env.GA4_PROPERTY_ID;
    const propertyUrl = `https://analytics.google.com/analytics/web/#/p${propertyId}/reports/intelligenthome`;
    const client = getClient();
    if (!client)
        return { configured: false, error: "Could not initialize Google Analytics client" };
    try {
        const [summary7, summary30, summaryAll, dailyAll, pages] = await Promise.all([
            client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
                metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
            }),
            client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
                metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
            }),
            client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate: ALL_TIME_START, endDate: "today" }],
                metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
            }),
            client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate: ALL_TIME_START, endDate: "today" }],
                dimensions: [{ name: "date" }],
                metrics: [{ name: "sessions" }],
                orderBys: [{ dimension: { dimensionName: "date" } }],
            }),
            client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
                dimensions: [{ name: "pagePath" }],
                metrics: [{ name: "screenPageViews" }],
                orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
                limit: 5,
            }),
        ]);
        const row = (res) => res?.[0]?.rows?.[0]?.metricValues?.map((v) => parseInt(v.value, 10)) || [0, 0, 0];
        const [s7, u7, p7] = row(summary7);
        const [s30, u30, p30] = row(summary30);
        const [sAll, uAll, pAll] = row(summaryAll);
        const dailySeries = (dailyAll?.[0]?.rows || []).map((r) => {
            const raw = r.dimensionValues?.[0]?.value || '';
            // GA4 returns dates as YYYYMMDD — format to YYYY-MM-DD for the chart.
            const date = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
            return { date, sessions: parseInt(r.metricValues?.[0]?.value || '0', 10) };
        });
        return {
            configured: true,
            propertyUrl,
            last7Days: { sessions: s7, activeUsers: u7, pageViews: p7 },
            last30Days: { sessions: s30, activeUsers: u30, pageViews: p30 },
            allTime: { sessions: sAll, activeUsers: uAll, pageViews: pAll, sinceDate: ALL_TIME_START },
            dailySeries,
            topPages: (pages?.[0]?.rows || []).map((r) => ({
                path: r.dimensionValues?.[0]?.value || "?",
                views: parseInt(r.metricValues?.[0]?.value || "0", 10),
            })),
        };
    }
    catch (e) {
        logger_1.default.warn({ e: e?.message }, "⚠️ Google Analytics report failed");
        return { configured: true, propertyUrl, error: e?.message || "Failed to fetch analytics" };
    }
}
