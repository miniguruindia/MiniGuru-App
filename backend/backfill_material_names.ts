// backend/backfill_material_names.ts
//
// One-time fix for historical data. Material names are resolved ONCE, at
// project-creation time, and permanently stored on Project.materials — they
// are never re-looked-up on read. Every project created before the Aug 1
// 2026 fix to addNameToMaterials() (which queried the dead "Product" model
// instead of "Material") has materials permanently saved with a blank/null
// name, and possibly a missing quantity too on very old records. Going
// forward, new projects are fine — this only repairs what's already there.
//
// Safe to re-run: only touches projects that actually have a material with
// a missing name, and only fills in what's missing (never overwrites a
// name/quantity that's already correctly set).
//
// Run: cd backend && npx ts-node backfill_material_names.ts

import prisma from './src/utils/prismaClient';

async function main() {
  console.log('Scanning projects for materials with missing names...');

  const allProjects = await prisma.project.findMany({
    select: { id: true, title: true, materials: true },
  });

  const materialCache = new Map<string, string>();
  async function nameFor(productId: string): Promise<string | undefined> {
    if (materialCache.has(productId)) return materialCache.get(productId);
    const material = await prisma.material.findUnique({
      where: { id: productId },
      select: { name: true },
    });
    if (material?.name) materialCache.set(productId, material.name);
    return material?.name;
  }

  let fixedProjects = 0;
  let fixedMaterialLines = 0;
  let unresolvable = 0;

  for (const project of allProjects) {
    const materials = (project.materials as any[]) || [];
    if (materials.length === 0) continue;

    let changed = false;
    const repaired = [];
    for (const m of materials) {
      if (m && !m.name && m.productId) {
        const realName = await nameFor(m.productId);
        if (realName) {
          repaired.push({ ...m, name: realName, quantity: m.quantity ?? 1 });
          changed = true;
          fixedMaterialLines++;
        } else {
          // Material was deleted from the catalog since, or productId is
          // stale/malformed — leave it as-is rather than guessing a name.
          repaired.push(m);
          unresolvable++;
        }
      } else {
        repaired.push(m);
      }
    }

    if (changed) {
      await prisma.project.update({
        where: { id: project.id },
        data: { materials: repaired },
      });
      fixedProjects++;
      console.log(`  ✅ Fixed "${project.title}" (${project.id})`);
    }
  }

  console.log('');
  console.log(`Done. ${fixedProjects} project(s) updated, ${fixedMaterialLines} material name(s) filled in.`);
  if (unresolvable > 0) {
    console.log(`⚠️ ${unresolvable} material line(s) could not be resolved — the material may have been deleted from the catalog since. Left unchanged.`);
  }
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
