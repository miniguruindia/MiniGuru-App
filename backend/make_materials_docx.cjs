// backend/make_materials_docx.cjs
// Builds a Word file listing every material: picture, name, category, Goins value
// and where it shows (Shop / Planning / Both). Reads ~/materials_export.json
// (made by export_materials_json.ts) and writes ~/MiniGuru_Materials_Goins_List.docx
//
// Needs the npm packages "docx" (and "sharp" for the small pictures). If sharp is
// missing the list is still made, just without pictures.

const fs = require('fs');
const os = require('os');
const path = require('path');
const docx = require('docx');
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, ImageRun,
  WidthType, ShadingType, AlignmentType, HeadingLevel, PageOrientation, VerticalAlign,
} = docx;

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.log('(sharp is not installed - making the list without pictures)'); }

const input = process.argv[2] || path.join(os.homedir(), 'materials_export.json');
const output = process.argv[3] || path.join(os.homedir(), 'MiniGuru_Materials_Goins_List.docx');

const materials = JSON.parse(fs.readFileSync(input, 'utf8'));

function whereLabel(m) {
  const shop = m.showInShop !== false;
  const plan = m.showInPlanning !== false;
  let label = shop && plan ? 'Both' : shop ? 'Shop only' : plan ? 'Planning only' : 'Hidden';
  if (m.isActive === false) label += ' (inactive)';
  return label;
}

// ── pictures: download + shrink to a small JPEG (keeps the file light) ───────
const imageCache = new Map();
async function loadImage(url) {
  if (!sharp || !url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  let result = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      result = await sharp(buf)
        .resize(72, 72, { fit: 'contain', background: '#ffffff' })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 70 })
        .toBuffer();
    }
  } catch (e) {
    result = null;
  }
  imageCache.set(url, result);
  return result;
}

async function loadAllImages() {
  const urls = Array.from(new Set(materials.map((m) => m.imageUrl).filter(Boolean)));
  let done = 0;
  const queue = urls.slice();
  async function worker() {
    while (queue.length > 0) {
      const u = queue.shift();
      await loadImage(u);
      done++;
      if (done % 50 === 0) console.log('  pictures: ' + done + ' / ' + urls.length);
    }
  }
  if (sharp && urls.length > 0) {
    console.log('Downloading ' + urls.length + ' pictures...');
    await Promise.all(Array.from({ length: 8 }, worker));
  }
}

// ── table layout (landscape A4) ──────────────────────────────────────────────
const COLS = [700, 1200, 6400, 1700, 1300, 1200, 2000];
const TABLE_W = COLS.reduce((a, b) => a + b, 0);
const BORDER = { style: 'single', size: 4, color: 'D1D5DB' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const MARGINS = { top: 60, bottom: 60, left: 100, right: 100 };

function cell(children, width, opts) {
  opts = opts || {};
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    margins: MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children,
  });
}

function text(t, o) {
  return new Paragraph({
    alignment: (o && o.align) || AlignmentType.LEFT,
    children: [new TextRun({ text: String(t), bold: o && o.bold, size: (o && o.size) || 20, color: o && o.color })],
  });
}

function headerRow() {
  const heads = ['#', 'Image', 'Name', 'Unit', 'Price (Rs)', 'Goins', 'Shows in'];
  return new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: heads.map((h, i) => cell([text(h, { bold: true, color: '1B5E20' })], COLS[i], { fill: 'E8F5E9' })),
  });
}

function materialRow(m, n) {
  const img = m.imageUrl ? imageCache.get(m.imageUrl) : null;
  const imgPara = img
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'jpg', data: img, transformation: { width: 48, height: 48 } })],
      })
    : text(m.imageUrl ? '(no preview)' : '-', { size: 16, color: '9CA3AF', align: AlignmentType.CENTER });

  const cats = Array.isArray(m.categories) ? m.categories.filter((c) => c && c !== m.category) : [];
  const nameParas = [text(m.name || '', { bold: true })];
  if (cats.length > 0) nameParas.push(text('Also in: ' + cats.join(', '), { size: 16, color: '6B7280' }));

  return new TableRow({
    cantSplit: true,
    children: [
      cell([text(n, { align: AlignmentType.CENTER, color: '6B7280' })], COLS[0]),
      cell([imgPara], COLS[1]),
      cell(nameParas, COLS[2]),
      cell([text(m.unit || 'piece')], COLS[3]),
      cell([text(m.priceEstimate > 0 ? m.priceEstimate : '-', { align: AlignmentType.RIGHT })], COLS[4]),
      cell([text(m.goinsPrice, { bold: true, color: '8B6800', align: AlignmentType.CENTER })], COLS[5]),
      cell([text(whereLabel(m))], COLS[6]),
    ],
  });
}

async function main() {
  await loadAllImages();

  const byCat = new Map();
  for (const m of materials) {
    const c = m.category || 'Other';
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(m);
  }
  const cats = Array.from(byCat.keys()).sort((a, b) => a.localeCompare(b));
  for (const c of cats) byCat.get(c).sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const count = (f) => materials.filter(f).length;
  const both = count((m) => m.showInShop !== false && m.showInPlanning !== false);
  const shopOnly = count((m) => m.showInShop !== false && m.showInPlanning === false);
  const planOnly = count((m) => m.showInShop === false && m.showInPlanning !== false);
  const hidden = count((m) => m.showInShop === false && m.showInPlanning === false);
  const goins = materials.map((m) => m.goinsPrice).filter((g) => typeof g === 'number').sort((a, b) => a - b);

  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: 'MiniGuru - Materials and Goins list', bold: true })] }),
    text('Generated ' + new Date().toISOString().slice(0, 10) + '. Goins use the rule: 1 Goin = Rs 10 of Amazon price per unit, minimum 5 (unless edited by hand).', { color: '6B7280' }),
    text(materials.length + ' materials in ' + cats.length + ' categories. Both: ' + both + ' | Shop only: ' + shopOnly + ' | Planning only: ' + planOnly + ' | Hidden: ' + hidden + '.', { bold: true }),
    goins.length > 0 ? text('Goins range: lowest ' + goins[0] + ', median ' + goins[Math.floor(goins.length / 2)] + ', highest ' + goins[goins.length - 1] + '.') : text(''),
  ];

  let n = 0;
  for (const c of cats) {
    const items = byCat.get(c);
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 }, children: [new TextRun({ text: c + ' (' + items.length + ')', bold: true })] }));
    children.push(new Table({
      width: { size: TABLE_W, type: WidthType.DXA },
      columnWidths: COLS,
      rows: [headerRow()].concat(items.map((m) => materialRow(m, ++n))),
    }));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children,
    }],
  });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(output, buf);
  console.log('Saved: ' + output + ' (' + Math.round(buf.length / 1024) + ' KB)');
}

main().catch((e) => { console.error(e); process.exit(1); });
