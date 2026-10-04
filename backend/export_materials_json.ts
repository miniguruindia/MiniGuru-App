// backend/export_materials_json.ts
// Step 1 of making the Word list: saves every material (name, category, unit,
// price, Goins, picture link, shop/planning flags) to ~/materials_export.json.
// Read-only — changes nothing in the database.
//   cd backend && npx ts-node export_materials_json.ts
import * as fs from 'fs';
import * as os from 'os';
import prisma from './src/utils/prismaClient';

async function main() {
  const mats: any[] = await (prisma as any).material.findMany({
    select: {
      name: true, category: true, categories: true, unit: true, goinsPrice: true,
      priceEstimate: true, imageUrl: true, showInShop: true, showInPlanning: true, isActive: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  const out = os.homedir() + '/materials_export.json';
  fs.writeFileSync(out, JSON.stringify(mats));
  console.log('Exported ' + mats.length + ' materials to ' + out);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
