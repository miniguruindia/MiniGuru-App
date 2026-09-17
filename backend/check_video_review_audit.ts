// backend/check_video_review_audit.ts
//
// One-off diagnostic (Sept 2026) — a project ("Ishaan Sumit Goenka") was
// found live/published without ever having gone through an admin approval
// click. The full create -> AI-review -> admin-approve pipeline was
// audited against current main and found structurally sound (only one
// place a Project is ever created, only one place status ever becomes
// 'published' -- videoApprovalController.ts's publishAndAwardProject,
// which itself is now ONLY ever called from the admin-authenticated
// POST /admin/projects/:id/approve route, per the same-session fix that
// removed the old AI-auto-publish shortcut).
//
// This script finds every 'published' project and flags any that look
// like they slipped through without a real AI review having run (aiVerdict
// null/missing) -- the only class of "published but never reviewed" state
// the current schema can actually detect. It changes nothing; it only
// reports, so it's always safe to re-run.
//
// Run with: cd backend && npx ts-node check_video_review_audit.ts
// (remember: a fresh Cloud Shell session needs DATABASE_URL exported
// manually first -- standalone scripts don't inherit Cloud Run's env vars)

import prisma from './src/utils/prismaClient';

async function main() {
  const published = await prisma.project.findMany({
    where: { status: 'published' },
    select: {
      id: true,
      title: true,
      userId: true,
      user: { select: { name: true } },
      aiVerdict: true,
      aiConfidence: true,
      aiReviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total published projects: ${published.length}\n`);

  const noAiReview = published.filter((p) => !p.aiVerdict);
  console.log(`Published with NO aiVerdict on record (pre-dates AI review, or something bypassed it): ${noAiReview.length}`);
  for (const p of noAiReview) {
    console.log(`  - "${p.title}" by ${p.user?.name ?? p.userId} | created ${p.createdAt.toISOString()} | published (updatedAt) ${p.updatedAt.toISOString()}`);
  }

  console.log('');
  const suspiciouslyFast = published.filter((p) => p.aiVerdict && p.aiReviewedAt &&
    (p.updatedAt.getTime() - p.createdAt.getTime()) < 5000); // published within 5s of creation
  console.log(`Published within 5 seconds of creation (only possible if AI auto-approved at upload time -- confirms whether the old auto-publish path fired for these, back when it still existed): ${suspiciouslyFast.length}`);
  for (const p of suspiciouslyFast) {
    console.log(`  - "${p.title}" | aiVerdict=${p.aiVerdict} confidence=${p.aiConfidence} | created ${p.createdAt.toISOString()}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
