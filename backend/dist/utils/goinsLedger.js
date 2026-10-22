"use strict";
// backend/src/utils/goinsLedger.ts
// Goins earnings ledger helpers + Indian-time period maths for the Ladder.
// Everything here is best-effort: it must NEVER throw into a caller.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_COMMENT_GOINS_CAP = exports.DAILY_VIEW_GOINS_CAP = void 0;
exports.guardianIdsFor = guardianIdsFor;
exports.recordGoinsEvents = recordGoinsEvents;
exports.periodRange = periodRange;
exports.istDayStart = istDayStart;
exports.goinsEarnedToday = goinsEarnedToday;
const prismaClient_1 = __importDefault(require("./prismaClient"));
// The ledger model is accessed loosely on purpose so this file compiles even
// before `prisma generate` has been re-run on a machine.
const db = prismaClient_1.default;
/** userId -> guardianId (the school/parent account) for child accounts. */
async function guardianIdsFor(userIds) {
    const out = {};
    for (const id of userIds)
        out[id] = null;
    if (userIds.length === 0)
        return out;
    try {
        const rows = await prismaClient_1.default.childProfile.findMany({
            where: { linkedUserId: { in: userIds }, isActive: true },
            select: { linkedUserId: true, guardianId: true },
        });
        for (const r of rows) {
            if (r.linkedUserId)
                out[r.linkedUserId] = r.guardianId;
        }
    }
    catch (e) {
        console.warn('[goinsLedger] guardian lookup failed (non-fatal):', e.message);
    }
    return out;
}
/** Writes ledger rows. Never throws. Zero-amount rows are skipped. */
async function recordGoinsEvents(events) {
    try {
        const rows = events.filter((e) => e && e.amount !== 0 && e.userId);
        if (rows.length === 0)
            return;
        const guardians = await guardianIdsFor(Array.from(new Set(rows.map((r) => r.userId))));
        await db.goinsEvent.createMany({
            data: rows.map((r) => ({
                userId: r.userId,
                guardianId: guardians[r.userId] || null,
                amount: r.amount,
                source: r.source,
                projectId: r.projectId || null,
                categoryId: r.categoryId || null,
                reason: r.reason || null,
                breakdown: r.breakdown === undefined ? undefined : r.breakdown,
            })),
        });
    }
    catch (e) {
        console.error('[goinsLedger] could not record events (non-fatal):', e.message);
    }
}
// ── Periods, in Indian Standard Time (UTC+5:30, no daylight saving) ─────────
const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function fmtDay(istMs) {
    const d = new Date(istMs);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/**
 * The [start, end) window for a period. offset 0 = the current one,
 * -1 = the previous one, and so on. Weeks run Monday–Sunday.
 */
function periodRange(period, offset) {
    const ist = new Date(Date.now() + IST_MS);
    const y = ist.getUTCFullYear();
    const m = ist.getUTCMonth();
    const d = ist.getUTCDate();
    let startIst;
    let endIst;
    let label;
    if (period === 'week') {
        const dow = (ist.getUTCDay() + 6) % 7; // Monday = 0
        startIst = Date.UTC(y, m, d - dow + 7 * offset);
        endIst = startIst + 7 * DAY_MS;
        label = `Week of ${fmtDay(startIst)} – ${fmtDay(endIst - DAY_MS)}`;
    }
    else if (period === 'month') {
        startIst = Date.UTC(y, m + offset, 1);
        endIst = Date.UTC(y, m + offset + 1, 1);
        const s = new Date(startIst);
        label = `${MONTHS_LONG[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
    }
    else {
        startIst = Date.UTC(y + offset, 0, 1);
        endIst = Date.UTC(y + offset + 1, 0, 1);
        label = String(new Date(startIst).getUTCFullYear());
    }
    return { start: new Date(startIst - IST_MS), end: new Date(endIst - IST_MS), label };
}
// ── Daily caps on engagement Goins (anti-farming) ───────────────────────────
// Views and comments are the only Goins a child can earn in bulk without a
// project, so each has a per-day ceiling (IST day). Approvals, ratings, quests
// and top-ups are never capped. Fail-open: if the ledger cannot be read the
// Goin is still paid (a missing ledger must never block a child).
exports.DAILY_VIEW_GOINS_CAP = 20;
exports.DAILY_COMMENT_GOINS_CAP = 10;
function istDayStart() {
    const ist = new Date(Date.now() + IST_MS);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_MS);
}
/** Goins this user earned today (IST) from the given ledger sources. */
async function goinsEarnedToday(userId, sources) {
    try {
        const rows = await db.goinsEvent.findMany({
            where: { userId, source: { in: sources }, createdAt: { gte: istDayStart() } },
            select: { amount: true },
        });
        return rows.reduce((t, r) => t + (r.amount || 0), 0);
    }
    catch (e) {
        console.warn('[goinsLedger] daily total failed (non-fatal):', e.message);
        return 0;
    }
}
