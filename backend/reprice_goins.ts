// backend/reprice_goins.ts
// One-time Goins repricing from the REAL Amazon price per unit.
//
//   Goins per unit  =  priceEstimate / pieces in the pack   (1 Goin = Rs 1,
//   adjustable with --scale, e.g. --scale 0.5 makes everything half as costly)
//
// DRY-RUN BY DEFAULT: prints a summary, writes a full CSV to
// /tmp/goins_reprice_report.csv, and changes NOTHING in the database.
//
//   cd backend && npx ts-node reprice_goins.ts                 (dry run)
//   cd backend && npx ts-node reprice_goins.ts --apply         (write changes)
//
// Safety rules:
//  - Only materials with a Rs price estimate are considered.
//  - Pack size is read ONLY from clear units: "pack of 5", "set of 12",
//    "10 pcs", "20 pieces", "6 count", or the plain default "piece" (= 1).
//    Anything else (ml, g, kg, litres, unclear text) is listed as
//    "needs review" and is NEVER changed automatically.
//  - By default only materials still at the old flat default (10 Goins) are
//    changed, so any rate you set by hand stays. Add --all to include those.
//  - Minimum is 1 Goin. Variant/other fields are never touched.

import * as fs from 'fs';
import prisma from './src/utils/prismaClient';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ALL = args.includes('--all');
const scaleIdx = args.indexOf('--scale');
const SCALE = scaleIdx >= 0 ? parseFloat(args[scaleIdx + 1]) : 1;
if (!(SCALE > 0)) {
  console.error('--scale must be a number above 0');
  process.exit(1);
}

function packQty(unitRaw: string | null | undefined): number | null {
  const u = (unitRaw || 'piece').trim().toLowerCase();
  if (u === '' || u === 'piece' || u === 'pc' || u === 'unit' || u === 'each') return 1;
  const patterns: RegExp[] = [
    /\bpack of (\d+)\b/,
    /\bset of (\d+)\b/,
    /\b(\d+)\s*(?:pcs|pieces|pc)\b/,
    /\b(\d+)\s*count\b/,
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      return n > 0 ? n : null;
    }
  }
  return null;
}

function csvCell(v: any): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function main() {
  const mats: any[] = await (prisma as any).material.findMany({
    select: { id: true, name: true, unit: true, goinsPrice: true, priceEstimate: true },
    orderBy: { name: 'asc' },
  });

  const rows: any[] = [];
  let noPrice = 0;
  for (const m of mats) {
    if (!(typeof m.priceEstimate === 'number' && m.priceEstimate > 0)) {
      noPrice++;
      rows.push({ ...m, status: 'no price estimate', proposed: '' });
      continue;
    }
    const q = packQty(m.unit);
    if (q === null) {
      rows.push({ ...m, status: 'needs review (unit not a clear piece count)', proposed: '' });
      continue;
    }
    const proposed = Math.max(1, Math.round((m.priceEstimate / q) * SCALE));
    const isFlat = m.goinsPrice === 10;
    if (!isFlat && !ALL) {
      rows.push({ ...m, status: 'kept (rate was set by hand)', proposed });
    } else if (proposed === m.goinsPrice) {
      rows.push({ ...m, status: 'already right', proposed });
    } else {
      rows.push({ ...m, status: APPLY ? 'UPDATED' : 'would update', proposed });
    }
  }

  const toChange = rows.filter((r) => r.status === 'UPDATED' || r.status === 'would update');
  if (APPLY) {
    for (const r of toChange) {
      await (prisma as any).material.update({ where: { id: r.id }, data: { goinsPrice: r.proposed } });
    }
  }

  const header = ['name', 'unit', 'price_rs', 'current_goins', 'proposed_goins', 'status'];
  const lines = [header.join(',')].concat(
    rows.map((r) => [r.name, r.unit, r.priceEstimate, r.goinsPrice, r.proposed, r.status].map(csvCell).join(','))
  );
  fs.writeFileSync('/tmp/goins_reprice_report.csv', lines.join('\n') + '\n');

  const count = (s: string) => rows.filter((r) => r.status.startsWith(s)).length;
  console.log('Materials checked:               ' + mats.length);
  console.log('No price estimate (skipped):     ' + noPrice);
  console.log('Needs review (unclear unit):     ' + count('needs review'));
  console.log('Kept (rate set by hand):         ' + count('kept'));
  console.log('Already right:                   ' + count('already right'));
  console.log((APPLY ? 'UPDATED:                         ' : 'Would update:                    ') + toChange.length);
  console.log('');
  console.log('First changes:');
  toChange.slice(0, 15).forEach((r) =>
    console.log('  ' + r.name + '  [' + (r.unit || 'piece') + ', Rs ' + r.priceEstimate + ']  ' + r.goinsPrice + ' -> ' + r.proposed)
  );
  console.log('');
  console.log('Full list saved to /tmp/goins_reprice_report.csv');
  if (!APPLY) console.log('DRY RUN — nothing was changed. Re-run with --apply to write these.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
