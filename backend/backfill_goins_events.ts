// backend/backfill_goins_events.ts
// One-time backfill of the Goins ledger from what can still be reconstructed:
//   1. Project approvals — read from each user's scoreHistory entries whose
//      reason looks like:  "Title" approved: +NN Goins (...)
//      (these carry the exact amount and time; written since late July 2026).
//   2. Peer ratings received — from VideoRating rows, split equally across the
//      project's owner + collaborators, timed at the rating's createdAt.
// Anything earlier than that simply isn't recorded anywhere and is skipped.
//
// Guarded: refuses to run twice (so boards can't double-count) unless you
// pass --force, which first deletes the previous backfill rows.
//
// Run from Cloud Shell:  cd backend && npx ts-node backfill_goins_events.ts
// (needs DATABASE_URL exported — same as the other one-time scripts)

import prisma from './src/utils/prismaClient';

const db: any = prisma;

function splitEqually(total: number, ids: string[]): number[] {
  const each = Math.floor(total / ids.length);
  const rem = total - each * ids.length;
  return ids.map((_, i) => (i === 0 ? each + rem : each));
}

async function main() {
  const force = process.argv.includes('--force');
  const existing = await db.goinsEvent.count({ where: { isBackfill: true } });
  if (existing > 0 && !force) {
    console.log(`Backfill already done (${existing} rows). Nothing changed. Use --force to redo it.`);
    return;
  }
  if (existing > 0 && force) {
    const del = await db.goinsEvent.deleteMany({ where: { isBackfill: true } });
    console.log(`--force: removed ${del.count} earlier backfill rows.`);
  }

  const projects = await prisma.project.findMany({
    select: { id: true, title: true, userId: true, categoryId: true, collaborators: true },
  });
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  const events: any[] = [];

  // 1. approvals from scoreHistory
  const users = await prisma.user.findMany({ select: { id: true, scoreHistory: true } });
  const re = /^"(.*)" approved: \+(\d+) Goins/;
  for (const u of users) {
    for (const h of (u.scoreHistory as any[]) || []) {
      const m = re.exec(h.reason || '');
      if (!m) continue;
      const amount = parseInt(m[2], 10);
      if (!(amount > 0)) continue;
      const title = m[1];
      const p = projects.find(
        (x) => x.title === title && (x.userId === u.id || ((x.collaborators as any[]) || []).some((c) => c.userId === u.id))
      );
      events.push({
        userId: u.id, amount, source: 'PROJECT_APPROVAL', projectId: p ? p.id : null,
        categoryId: p ? p.categoryId : null, reason: h.reason, createdAt: new Date(h.time), isBackfill: true,
      });
    }
  }
  const approvalCount = events.length;

  // 2. peer ratings received
  const ratings = await prisma.videoRating.findMany();
  for (const r of ratings) {
    const p = projectsById.get(r.videoId);
    if (!p || !(r.goinsAwarded > 0)) continue;
    const ids = [p.userId, ...(((p.collaborators as any[]) || []).map((c) => c.userId))];
    const shares = splitEqually(r.goinsAwarded, ids);
    ids.forEach((uid, i) => {
      if (shares[i] > 0) {
        events.push({
          userId: uid, amount: shares[i], source: 'PEER_RATING', projectId: p.id, categoryId: p.categoryId,
          reason: 'Peer rating received', createdAt: r.createdAt, isBackfill: true,
        });
      }
    });
  }
  const ratingCount = events.length - approvalCount;

  // school link (best effort, current membership)
  const allIds = Array.from(new Set(events.map((e) => e.userId)));
  const guardianByUser: Record<string, string | null> = {};
  if (allIds.length > 0) {
    const cps = await prisma.childProfile.findMany({
      where: { linkedUserId: { in: allIds }, isActive: true },
      select: { linkedUserId: true, guardianId: true },
    });
    for (const c of cps) if (c.linkedUserId) guardianByUser[c.linkedUserId] = c.guardianId;
  }
  for (const e of events) e.guardianId = guardianByUser[e.userId] || null;

  for (let i = 0; i < events.length; i += 500) {
    await db.goinsEvent.createMany({ data: events.slice(i, i + 500) });
  }
  console.log(`Done. Backfilled ${events.length} ledger rows (${approvalCount} project approvals, ${ratingCount} peer ratings).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
