// backend/seed_about_consultancy_legal_v2.ts
//
// One-off migration: pushes the CORRECTED about / consultancy / legal_privacy /
// legal_terms / legal_child_safety / legal_cookie / faq content into MongoDB,
// overwriting whatever stale content is sitting there today.
//
// This is necessary, not optional: cmsRoutes.ts's DEFAULTS object is only
// ever used as a fallback when there is NO existing DB record for a key. All
// of these keys already have DB records (from earlier sessions), so simply
// fixing the code-level DEFAULTS does nothing to what's actually live until
// this script is run.
//
// Content pushed here is imported directly from cmsRoutes.ts's exported
// DEFAULTS — not retyped — so the DB and the code fallback can never drift
// apart again.
//
// Run with: cd backend && npx ts-node seed_about_consultancy_legal_v2.ts
//
// Rule 21 reminder: this uses ts-node, not `node`, because MongoDB Atlas SRV
// DNS resolution fails when run with plain `node` from inside a Codespace.

import prisma from './src/utils/prismaClient';
import { DEFAULTS } from './src/routes/cmsRoutes';

const KEYS_TO_MIGRATE = [
  'about',
  'consultancy',
  'legal_privacy',
  'legal_terms',
  'legal_child_safety',
  'legal_cookie',
  'faq',
] as const;

async function main() {
  console.log('Pushing corrected content for:', KEYS_TO_MIGRATE.join(', '));
  console.log('');

  for (const key of KEYS_TO_MIGRATE) {
    const value = DEFAULTS[key];
    if (value === undefined) {
      console.log(`⚠️  Skipped ${key} — not found in DEFAULTS (check cmsRoutes.ts)`);
      continue;
    }

    // Show what's there right now, before we overwrite it, so there's a
    // record in the terminal output of what changed.
    const existing = await (prisma as any).siteContent.findUnique({ where: { key } });
    if (existing) {
      const preview = JSON.stringify(existing.value).slice(0, 80);
      console.log(`   ${key}: had existing content (${preview}...) — overwriting`);
    } else {
      console.log(`   ${key}: no existing record — creating fresh`);
    }

    await (prisma as any).siteContent.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    });
    console.log(`✅ ${key} updated`);
  }

  console.log('');
  console.log('✅ All content migrated. No Flutter rebuild needed — CMS is');
  console.log('   fetched at runtime. Hard-refresh (Ctrl+Shift+R) to see it.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
