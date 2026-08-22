// backend/fix_amazon_tag.ts
// ONE-TIME MIGRATION — Aug 2026: the Amazon Associates tracking ID changed
// from miniguru08-21 to miniguru04-21. All the CODE that BUILDS a new
// amazonUrl already uses the new tag as of this session's patch — but any
// Material (or, for completeness, any old dead-code Product) that already
// had an ASIN entered by admin has the OLD tag baked directly into its
// stored amazonUrl string. Changing the code alone does NOT retroactively
// fix those already-saved records — this script does that one-time fix.
//
// Safe to re-run: only touches records that still contain the old tag, so
// running it twice is a no-op the second time.
//
// Run with: cd backend && npx ts-node fix_amazon_tag.ts
// (Rule 21: do NOT run `node fix_amazon_tag.ts` directly — SRV DNS
// resolution to MongoDB Atlas fails from Codespace with plain node.)

import prisma from './src/utils/prismaClient';

const OLD_TAG = 'miniguru08-21';
const NEW_TAG = 'miniguru04-21';

async function main() {
  console.log(`Fixing stored Amazon URLs: ${OLD_TAG} -> ${NEW_TAG}\n`);

  // ── Material (the real, live catalog) ────────────────────────────────
  const materials = await prisma.material.findMany({
    where: { amazonUrl: { contains: OLD_TAG } },
  });
  console.log(`Found ${materials.length} Material record(s) with the old tag.`);
  let materialsFixed = 0;
  for (const m of materials) {
    const fixedUrl = (m.amazonUrl || '').split(OLD_TAG).join(NEW_TAG);
    await prisma.material.update({
      where: { id: m.id },
      data: { amazonUrl: fixedUrl },
    });
    materialsFixed++;
    console.log(`  ✓ ${m.name} (${m.id})`);
  }

  // ── Product (old, dead own-shop model — Rule 26 — but fix defensively
  // in case any stray record still exists) ─────────────────────────────
  const products = await prisma.product.findMany({
    where: { amazonUrl: { contains: OLD_TAG } },
  });
  console.log(`\nFound ${products.length} (dead-code) Product record(s) with the old tag.`);
  let productsFixed = 0;
  for (const p of products) {
    const fixedUrl = (p.amazonUrl || '').split(OLD_TAG).join(NEW_TAG);
    await prisma.product.update({
      where: { id: p.id },
      data: { amazonUrl: fixedUrl },
    });
    productsFixed++;
    console.log(`  ✓ ${p.name} (${p.id})`);
  }

  console.log(`\nDone. Materials fixed: ${materialsFixed}. Products fixed: ${productsFixed}.`);

  // ── Verify: confirm zero records with the old tag remain ────────────
  const remainingMaterials = await prisma.material.count({ where: { amazonUrl: { contains: OLD_TAG } } });
  const remainingProducts = await prisma.product.count({ where: { amazonUrl: { contains: OLD_TAG } } });
  console.log(`\nVerification — records still containing the OLD tag: materials=${remainingMaterials}, products=${remainingProducts}`);
  if (remainingMaterials === 0 && remainingProducts === 0) {
    console.log('✅ Clean — no old-tag URLs remain in the database.');
  } else {
    console.log('⚠️  Some records still have the old tag — investigate before considering this done.');
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Migration failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
