// backend/reprice_goins.ts  (v2)
// One-time Goins repricing from the real Amazon price per unit.
//
//   Goins per unit = priceEstimate / pieces in the pack, then scaled.
//   Default scale 0.1  (1 Goin = Rs 10).  Minimum 5 Goins.  Whole numbers only.
//
//   DRY RUN (changes nothing):      cd backend && npx ts-node reprice_goins.ts
//   APPLY:                          cd backend && npx ts-node reprice_goins.ts --apply
//   UNDO the last apply:            cd backend && npx ts-node reprice_goins.ts --restore ~/goins_backup_XXXX.json
//
// Options: --scale 0.1   --min 5   --all (also reprice rates that were set by hand)
//
// Safety rules:
//  - Pack size is read ONLY from clear units ("pack of 5", "set of 12", "10 pcs",
//    "20 pieces", "6 count") or the plain default "piece" (= 1). Anything else
//    (ml, g, kg, litres, unclear text) is listed as "needs review" and its
//    price is never changed automatically — it is only raised to the minimum.
//  - By default only materials still at the old flat 10 are repriced, so rates
//    you set by hand stay (they are only raised to the minimum if below it).
//  - Before --apply writes anything, the old value of EVERY material it will
//    change is saved to ~/goins_backup_<time>.json so the run can be undone.
//  - Goins prices are whole numbers in the database, so decimals cannot occur.

import * as fs from 'fs';
import * as os from 'os';
import prisma from './src/utils/prismaClient';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ALL = args.includes('--all');

function numArg(name: string, def: number): number {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = parseFloat(args[i + 1]);
  return Number.isFinite(v) && v > 0 ? v : NaN;
}
const SCALE = numArg('--scale', 0.1);
const MIN = Math.floor(numArg('--min', 5));
if (!(SCALE > 0) || !(MIN >= 1)) {
  console.error('--scale and --min must be numbers above 0 (min at least 1)');
  process.exit(1);
}

const db: any = prisma;

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

async function restore(file: string) {
  const old: Record<string, number> = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ids = Object.keys(old);
  for (const id of ids) {
    await db.material.update({ where: { id }, data: { goinsPrice: old[id] } });
  }
  console.log('Restored the old Goins price on ' + ids.length + ' materials from ' + file);
}

async function main() {
  const rIdx = args.indexOf('--restore');
  if (rIdx >= 0) {
    const f = args[rIdx + 1];
    if (!f || !fs.existsSync(f)) {
      console.error('Backup file not found: ' + f);
      process.exit(1);
    }
    await restore(f);
    return;
  }

  const mats: any[] = await db.material.findMany({
    select: { id: true, name: true, unit: true, goinsPrice: true, priceEstimate: true },
    orderBy: { name: 'asc' },
  });

  const rows: any[] = [];
  for (const m of mats) {
    const current: number = m.goinsPrice;
    let status = '';
    let proposed: number | '' = '';
    let final = current;

    const hasPrice = typeof m.priceEstimate === 'number' && m.priceEstimate > 0;
    if (!hasPrice) {
      status = 'no price estimate';
    } else {
      const q = packQty(m.unit);
      if (q === null) {
        status = 'needs review (unit not a clear piece count)';
      } else {
        proposed = Math.max(MIN, Math.round((m.priceEstimate / q) * SCALE));
        if (current === 10 || ALL) {
          final = proposed;
          status = proposed === current ? 'already right' : 'repriced';
        } else {
          status = 'kept (rate set by hand)';
        }
      }
    }
    if (final < MIN) {
      final = MIN;
      status += ' + raised to minimum';
    }
    rows.push({ ...m, status, proposed, final, changes: final !== current });
  }

  const toChange = rows.filter((r) => r.changes);

  if (APPLY && toChange.length > 0) {
    const backup: Record<string, number> = {};
    for (const r of toChange) backup[r.id] = r.goinsPrice;
    const backupFile = os.homedir() + '/goins_backup_' + Date.now() + '.json';
    fs.writeFileSync(backupFile, JSON.stringify(backup));
    console.log('Backup of old values saved to ' + backupFile);
    for (const r of toChange) {
      await db.material.update({ where: { id: r.id }, data: { goinsPrice: r.final } });
    }
    console.log('To undo: npx ts-node reprice_goins.ts --restore ' + backupFile);
  }

  const reportFile = os.homedir() + '/goins_reprice_report.csv';
  const header = ['name', 'unit', 'price_rs', 'current_goins', 'formula_goins', 'final_goins', 'status'];
  const lines = [header.join(',')].concat(
    rows.map((r) => [r.name, r.unit, r.priceEstimate, r.goinsPrice, r.proposed, r.final, r.status].map(csvCell).join(','))
  );
  fs.writeFileSync(reportFile, lines.join('\n') + '\n');

  const count = (s: string) => rows.filter((r) => r.status.startsWith(s)).length;
  console.log('Scale ' + SCALE + ' (1 Goin = Rs ' + Math.round(1 / SCALE) + '), minimum ' + MIN + ' Goins');
  console.log('Materials checked:               ' + mats.length);
  console.log('No price estimate:               ' + count('no price estimate'));
  console.log('Needs review (unclear unit):     ' + count('needs review'));
  console.log('Kept (rate set by hand):         ' + count('kept'));
  console.log('Repriced from Amazon price:      ' + count('repriced'));
  console.log('Already right:                   ' + count('already right'));
  console.log('Raised to the minimum of ' + MIN + ':     ' + rows.filter((r) => r.status.includes('raised to minimum')).length);
  console.log((APPLY ? 'CHANGED in the database:         ' : 'Would change:                    ') + toChange.length);

  console.log('');
  console.log('Sample of changes (old -> new Goins):');
  toChange.slice(0, 12).forEach((r) =>
    console.log('  ' + r.name + '  [' + (r.unit || 'piece') + ', Rs ' + r.priceEstimate + ']  ' + r.goinsPrice + ' -> ' + r.final)
  );

  const kept = rows.filter((r) => r.status.startsWith('kept') && typeof r.proposed === 'number');
  kept.sort((a, b) => Math.abs(b.goinsPrice - b.proposed) - Math.abs(a.goinsPrice - a.proposed));
  if (kept.length > 0) {
    console.log('');
    console.log('Hand-set rates furthest from the new formula (left as they are — use --all to reprice these too):');
    kept.slice(0, 10).forEach((r) =>
      console.log('  ' + r.name + '  [Rs ' + r.priceEstimate + ']  yours ' + r.goinsPrice + ' vs formula ' + r.proposed)
    );
  }

  const finals = rows.map((r) => r.final as number).sort((a, b) => a - b);
  if (finals.length > 0) {
    console.log('');
    console.log('After this run: lowest ' + finals[0] + ', median ' + finals[Math.floor(finals.length / 2)] + ', highest ' + finals[finals.length - 1] + ' Goins');
  }
  console.log('Full list: ' + reportFile);
  if (!APPLY) console.log('DRY RUN — nothing was changed. Add --apply to write these.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
