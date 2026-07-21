// backend/migrate_community_to_models.ts
//
// One-time, ADDITIVE migration: moves the Happenings and Challenges
// currently sitting in the 'community' CMS JSON blob (SiteContent) into
// the new real Happening/Challenge Prisma models, as already-APPROVED,
// admin-owned entries. Nothing is lost — this is purely a structural
// move, not a data change.
//
// Safe to re-run: matches existing DB rows by `title` and skips any that
// are already present.
//
// Run with ts-node (NOT plain node — MongoDB Atlas SRV DNS resolution
// fails from Codespace with plain node, per Rule 21):
//   cd backend && npx ts-node migrate_community_to_models.ts

import prisma from './src/utils/prismaClient';

async function main() {
  const site = await (prisma as any).siteContent.findUnique({ where: { key: 'community' } });
  const value: any = site?.value ?? {};

  const cmsHappenings: any[] = Array.isArray(value.happenings) ? value.happenings : [];
  const cmsChallenges: any[] = Array.isArray(value.challenges) ? value.challenges : [];

  let happeningsMigrated = 0;
  for (const h of cmsHappenings) {
    const already = await prisma.happening.findFirst({ where: { title: h.title } });
    if (already) continue;

    await prisma.happening.create({
      data: {
        title: h.title || 'Untitled',
        description: h.description || '',
        date: h.date ? new Date(h.date) : new Date(),
        city: h.city || null,
        schoolName: h.schoolName || null,
        emoji: h.emoji || '🏫',
        tag: h.tag || 'Update',
        tagColor: h.tagColor || null,
        imageUrl: h.imageUrl || null,
        status: 'APPROVED',
        submittedById: null,
        submittedByName: null,
        approvedById: null,
        approvedAt: new Date(),
      },
    });
    happeningsMigrated++;
  }

  let challengesMigrated = 0;
  for (const c of cmsChallenges) {
    const already = await prisma.challenge.findFirst({ where: { title: c.title } });
    if (already) continue;

    await prisma.challenge.create({
      data: {
        title: c.title || 'Untitled',
        description: c.description || '',
        category: c.category || '',
        categoryEmoji: c.categoryEmoji || null,
        difficulty: c.difficulty || 'Medium',
        goinsReward: Number(c.goinsReward) || 100,
        endDate: c.endDate ? new Date(c.endDate) : new Date(),
        participants: Number(c.participants) || 0,
        color: c.color || null,
        lifecycleStatus: c.status || 'upcoming', // old CMS field was called 'status' for the display lifecycle
        status: 'APPROVED', // moderation status
        audience: 'ALL',
        restrictedToUserId: null,
        submittedById: null,
        submittedByName: null,
        approvedById: null,
        approvedAt: new Date(),
      },
    });
    challengesMigrated++;
  }

  console.log(`✅ Migration complete.`);
  console.log(`   Happenings migrated: ${happeningsMigrated} (of ${cmsHappenings.length} in CMS blob)`);
  console.log(`   Challenges migrated: ${challengesMigrated} (of ${cmsChallenges.length} in CMS blob)`);
  console.log(`   The old CMS blob entries are left untouched (harmless leftovers) — the app`);
  console.log(`   will be switched over to read from the new /happenings and /challenges`);
  console.log(`   endpoints in the next phase of this feature, not from the CMS blob.`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
  });
