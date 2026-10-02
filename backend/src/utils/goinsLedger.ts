// backend/src/utils/goinsLedger.ts
// Goins earnings ledger helpers + Indian-time period maths for the Ladder.
// Everything here is best-effort: it must NEVER throw into a caller.

import prisma from './prismaClient';

// The ledger model is accessed loosely on purpose so this file compiles even
// before `prisma generate` has been re-run on a machine.
const db: any = prisma;

export type LedgerSource =
  | 'PROJECT_APPROVAL'
  | 'PEER_RATING'
  | 'VIEW'
  | 'COMMENT_GIVEN'
  | 'COMMENT_RECEIVED'
  | 'RATING_GIVEN'
  | 'DAILY_QUEST'
  | 'TOPUP'
  | 'ADMIN_ADJUST';

export interface LedgerInput {
  userId: string;
  amount: number;
  source: LedgerSource;
  projectId?: string | null;
  categoryId?: string | null;
  reason?: string | null;
  breakdown?: any;
}

/** userId -> guardianId (the school/parent account) for child accounts. */
export async function guardianIdsFor(userIds: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const id of userIds) out[id] = null;
  if (userIds.length === 0) return out;
  try {
    const rows = await prisma.childProfile.findMany({
      where: { linkedUserId: { in: userIds }, isActive: true },
      select: { linkedUserId: true, guardianId: true },
    });
    for (const r of rows) {
      if (r.linkedUserId) out[r.linkedUserId] = r.guardianId;
    }
  } catch (e) {
    console.warn('[goinsLedger] guardian lookup failed (non-fatal):', (e as Error).message);
  }
  return out;
}

/** Writes ledger rows. Never throws. Zero-amount rows are skipped. */
export async function recordGoinsEvents(events: LedgerInput[]): Promise<void> {
  try {
    const rows = events.filter((e) => e && e.amount !== 0 && e.userId);
    if (rows.length === 0) return;
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
  } catch (e) {
    console.error('[goinsLedger] could not record events (non-fatal):', (e as Error).message);
  }
}

// ── Periods, in Indian Standard Time (UTC+5:30, no daylight saving) ─────────
const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type Period = 'week' | 'month' | 'year';

function fmtDay(istMs: number): string {
  const d = new Date(istMs);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The [start, end) window for a period. offset 0 = the current one,
 * -1 = the previous one, and so on. Weeks run Monday–Sunday.
 */
export function periodRange(period: Period, offset: number): { start: Date; end: Date; label: string } {
  const ist = new Date(Date.now() + IST_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  let startIst: number;
  let endIst: number;
  let label: string;
  if (period === 'week') {
    const dow = (ist.getUTCDay() + 6) % 7; // Monday = 0
    startIst = Date.UTC(y, m, d - dow + 7 * offset);
    endIst = startIst + 7 * DAY_MS;
    label = `Week of ${fmtDay(startIst)} – ${fmtDay(endIst - DAY_MS)}`;
  } else if (period === 'month') {
    startIst = Date.UTC(y, m + offset, 1);
    endIst = Date.UTC(y, m + offset + 1, 1);
    const s = new Date(startIst);
    label = `${MONTHS_LONG[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  } else {
    startIst = Date.UTC(y + offset, 0, 1);
    endIst = Date.UTC(y + offset + 1, 0, 1);
    label = String(new Date(startIst).getUTCFullYear());
  }
  return { start: new Date(startIst - IST_MS), end: new Date(endIst - IST_MS), label };
}
