// backend/seed_material_expansion.ts
//
// Shop renovation — Phase 1 (Sept 2026). Adds a broad, genuinely useful
// candidate list of STEAM/craft/electronics materials, PLUS a starting set
// of "clubbed" category groups for search — WITHOUT ever creating a
// duplicate of anything already in the catalog.
//
// Safe to run more than once: on every run it re-checks the live database
// for what already exists (by name, case-insensitive) and only inserts
// what's genuinely missing. Nothing existing is ever touched, renamed, or
// removed.
//
// Run from the repo root's backend/ folder:
//   cd ~/MiniGuru-App/backend
//   export DATABASE_URL="mongodb+srv://miniguru_db:Nisarg%40311@cluster0.ykoud6h.mongodb.net/miniguru?retryWrites=true&w=majority&appName=Cluster0"
//   npx ts-node seed_material_expansion.ts
//
// (The DATABASE_URL export is only needed in a FRESH Cloud Shell session
// that hasn't sourced backend/.env — a documented gotcha for standalone
// scripts in this project.)

import prisma from './src/utils/prismaClient';

// ── Category groups — the "clubbed" umbrellas for search/browse ───────────
// Each member category below is a real, specific category a material can
// carry; the group just lets a search/filter surface all of them together.
// upsert by name, so re-running this is always safe.
const CATEGORY_GROUPS: { name: string; emoji: string; memberCategories: string[]; sortOrder: number }[] = [
  { name: 'Electronics & Circuits', emoji: '🔌', sortOrder: 1, memberCategories: [
    'Electronics', 'Sensors & Modules', 'Microcontrollers & Boards', 'Power & Batteries',
  ] },
  { name: 'Adhesives & Fasteners', emoji: '🧴', sortOrder: 2, memberCategories: [
    'Adhesives', 'Fasteners & Hardware',
  ] },
  { name: 'Paper & Cardboard', emoji: '📄', sortOrder: 3, memberCategories: [
    'Paper & Board', 'Cardboard & Boxes',
  ] },
  { name: 'Fabric, Craft & Art', emoji: '🧵', sortOrder: 4, memberCategories: [
    'Fabric & Craft', 'Art & Decoration',
  ] },
  { name: 'Tools & Safety', emoji: '🔧', sortOrder: 5, memberCategories: [
    'Tools & Equipment', 'Safety Gear',
  ] },
  { name: 'Science & Chemistry', emoji: '🧪', sortOrder: 6, memberCategories: [
    'Science & Chemistry',
  ] },
  { name: 'Structural & Building', emoji: '🏗️', sortOrder: 7, memberCategories: [
    'Structural & Building Materials', '3D Printing & Fabrication',
  ] },
  { name: 'Kits & Bundles', emoji: '📦', sortOrder: 8, memberCategories: [
    'Advanced Kits',
  ] },
];

// ── Candidate materials ─────────────────────────────────────────────────
// name, categories (first = primary, kept in sync with the legacy
// `category` field), aliases (lowercase alternate search names), unit,
// goinsPrice (a rough, motivation-only scale — 5 common/cheap, 10 mid,
// 15 specialty/electronics; NOT meant to be a literal ₹ conversion).
type Candidate = { name: string; categories: string[]; aliases?: string[]; unit?: string; goinsPrice: number };

const CANDIDATES: Candidate[] = [
  // ── Adhesives (explicitly asked for: multiple glue types) ──────────
  { name: 'Fevicol (White Glue)', categories: ['Adhesives'], aliases: ['wood glue', 'white glue', 'fevicol'], unit: 'bottle', goinsPrice: 5 },
  { name: 'Hot Glue Gun', categories: ['Adhesives', 'Tools & Equipment'], aliases: ['glue gun'], unit: 'piece', goinsPrice: 10 },
  { name: 'Hot Glue Sticks', categories: ['Adhesives'], aliases: ['glue sticks'], unit: 'pack', goinsPrice: 5 },
  { name: 'Super Glue (Cyanoacrylate)', categories: ['Adhesives'], aliases: ['instant glue', 'fevikwik', 'ca glue'], unit: 'tube', goinsPrice: 5 },
  { name: 'Glue Stick (Solid)', categories: ['Adhesives'], aliases: ['uhu stick', 'pritt stick'], unit: 'piece', goinsPrice: 5 },
  { name: 'Fabric Glue', categories: ['Adhesives', 'Fabric & Craft'], aliases: ['cloth glue'], unit: 'bottle', goinsPrice: 5 },
  { name: 'Epoxy Adhesive (2-part)', categories: ['Adhesives'], aliases: ['araldite', 'epoxy resin glue'], unit: 'pack', goinsPrice: 10 },
  { name: 'Spray Adhesive', categories: ['Adhesives'], aliases: ['3m spray glue'], unit: 'can', goinsPrice: 10 },
  { name: 'Masking Tape', categories: ['Adhesives'], unit: 'roll', goinsPrice: 5 },
  { name: 'Duct Tape', categories: ['Adhesives'], unit: 'roll', goinsPrice: 5 },
  { name: 'Washi Tape', categories: ['Adhesives', 'Art & Decoration'], unit: 'roll', goinsPrice: 5 },
  { name: 'Foam Double-Sided Tape', categories: ['Adhesives'], unit: 'roll', goinsPrice: 5 },

  // ── Fasteners & Hardware ────────────────────────────────────────────
  { name: 'Wood Screws (Assorted)', categories: ['Fasteners & Hardware'], unit: 'pack', goinsPrice: 5 },
  { name: 'Nuts and Bolts Set', categories: ['Fasteners & Hardware'], unit: 'pack', goinsPrice: 5 },
  { name: 'Wing Nuts', categories: ['Fasteners & Hardware'], unit: 'pack', goinsPrice: 5 },
  { name: 'Cable Ties / Zip Ties', categories: ['Fasteners & Hardware'], aliases: ['zip ties'], unit: 'pack', goinsPrice: 5 },
  { name: 'Velcro Strips', categories: ['Fasteners & Hardware'], unit: 'pack', goinsPrice: 5 },
  { name: 'Paper Fasteners (Brads)', categories: ['Fasteners & Hardware'], aliases: ['brads'], unit: 'pack', goinsPrice: 5 },
  { name: 'Split Pins', categories: ['Fasteners & Hardware'], unit: 'pack', goinsPrice: 5 },
  { name: 'Safety Pins', categories: ['Fasteners & Hardware'], unit: 'pack', goinsPrice: 5 },
  { name: 'Push Pins / Thumb Tacks', categories: ['Fasteners & Hardware'], aliases: ['thumb tacks'], unit: 'pack', goinsPrice: 5 },
  { name: 'Binder Clips', categories: ['Fasteners & Hardware'], unit: 'pack', goinsPrice: 5 },
  { name: 'Rubber Bands', categories: ['Fasteners & Hardware'], unit: 'pack', goinsPrice: 5 },

  // ── Electronics (base components) ───────────────────────────────────
  { name: 'Resistors (Assorted Pack)', categories: ['Electronics'], aliases: ['resistor kit'], unit: 'pack', goinsPrice: 10 },
  { name: 'LED — Red', categories: ['Electronics'], aliases: ['red led'], unit: 'piece', goinsPrice: 5 },
  { name: 'LED — Green', categories: ['Electronics'], aliases: ['green led'], unit: 'piece', goinsPrice: 5 },
  { name: 'LED — Blue', categories: ['Electronics'], aliases: ['blue led'], unit: 'piece', goinsPrice: 5 },
  { name: 'LED — Yellow', categories: ['Electronics'], aliases: ['yellow led'], unit: 'piece', goinsPrice: 5 },
  { name: 'LED — White', categories: ['Electronics'], aliases: ['white led'], unit: 'piece', goinsPrice: 5 },
  { name: 'RGB LED', categories: ['Electronics'], unit: 'piece', goinsPrice: 10 },
  { name: 'Jumper Wires (Male-Male)', categories: ['Electronics'], unit: 'pack', goinsPrice: 10 },
  { name: 'Jumper Wires (Male-Female)', categories: ['Electronics'], unit: 'pack', goinsPrice: 10 },
  { name: 'Jumper Wires (Female-Female)', categories: ['Electronics'], unit: 'pack', goinsPrice: 10 },
  { name: 'Breadboard (Half Size)', categories: ['Electronics'], unit: 'piece', goinsPrice: 10 },
  { name: 'Breadboard (Full Size)', categories: ['Electronics'], unit: 'piece', goinsPrice: 15 },
  { name: 'Copper Wire (Single Core)', categories: ['Electronics'], unit: 'meter', goinsPrice: 5 },
  { name: 'Enamelled Copper Wire (Magnet Wire)', categories: ['Electronics'], aliases: ['magnet wire', 'coil wire'], unit: 'meter', goinsPrice: 10 },
  { name: 'Alligator Clip Wires', categories: ['Electronics'], aliases: ['crocodile clips'], unit: 'pack', goinsPrice: 10 },
  { name: 'Soldering Iron', categories: ['Electronics', 'Tools & Equipment'], unit: 'piece', goinsPrice: 15 },
  { name: 'Solder Wire', categories: ['Electronics'], unit: 'roll', goinsPrice: 10 },
  { name: 'Multimeter', categories: ['Electronics', 'Tools & Equipment'], unit: 'piece', goinsPrice: 15 },
  { name: 'Switch — Push Button', categories: ['Electronics'], aliases: ['push button switch'], unit: 'piece', goinsPrice: 5 },
  { name: 'Switch — Toggle', categories: ['Electronics'], aliases: ['toggle switch'], unit: 'piece', goinsPrice: 5 },
  { name: 'Switch — Slide', categories: ['Electronics'], aliases: ['slide switch'], unit: 'piece', goinsPrice: 5 },
  { name: 'Buzzer (Piezo)', categories: ['Electronics'], aliases: ['piezo buzzer'], unit: 'piece', goinsPrice: 5 },
  { name: 'Potentiometer', categories: ['Electronics'], aliases: ['pot', 'variable resistor'], unit: 'piece', goinsPrice: 10 },
  { name: 'Capacitor (Assorted Pack)', categories: ['Electronics'], unit: 'pack', goinsPrice: 10 },
  { name: 'Diode (1N4007)', categories: ['Electronics'], unit: 'piece', goinsPrice: 5 },
  { name: 'Transistor (BC547)', categories: ['Electronics'], unit: 'piece', goinsPrice: 5 },
  { name: 'IC — 555 Timer', categories: ['Electronics'], aliases: ['555 timer ic'], unit: 'piece', goinsPrice: 10 },

  // ── Sensors & Modules ────────────────────────────────────────────────
  { name: 'Ultrasonic Distance Sensor (HC-SR04)', categories: ['Sensors & Modules'], aliases: ['hc-sr04', 'distance sensor'], unit: 'piece', goinsPrice: 15 },
  { name: 'IR Obstacle Sensor', categories: ['Sensors & Modules'], aliases: ['infrared sensor'], unit: 'piece', goinsPrice: 10 },
  { name: 'PIR Motion Sensor', categories: ['Sensors & Modules'], aliases: ['motion sensor'], unit: 'piece', goinsPrice: 15 },
  { name: 'LDR (Light Dependent Resistor)', categories: ['Sensors & Modules'], aliases: ['light sensor', 'ldr'], unit: 'piece', goinsPrice: 5 },
  { name: 'Temperature Sensor (LM35)', categories: ['Sensors & Modules'], aliases: ['lm35'], unit: 'piece', goinsPrice: 10 },
  { name: 'Soil Moisture Sensor', categories: ['Sensors & Modules'], unit: 'piece', goinsPrice: 10 },
  { name: 'Sound Sensor Module', categories: ['Sensors & Modules'], unit: 'piece', goinsPrice: 10 },
  { name: 'Rain Sensor Module', categories: ['Sensors & Modules'], unit: 'piece', goinsPrice: 10 },
  { name: 'Flame Sensor', categories: ['Sensors & Modules'], unit: 'piece', goinsPrice: 10 },
  { name: 'Gas Sensor (MQ-2)', categories: ['Sensors & Modules'], aliases: ['mq-2', 'smoke sensor'], unit: 'piece', goinsPrice: 15 },

  // ── Microcontrollers & Boards ────────────────────────────────────────
  { name: 'Arduino Uno', categories: ['Microcontrollers & Boards'], unit: 'piece', goinsPrice: 15 },
  { name: 'Arduino Nano', categories: ['Microcontrollers & Boards'], unit: 'piece', goinsPrice: 15 },
  { name: 'ESP32 Dev Board', categories: ['Microcontrollers & Boards'], aliases: ['esp32'], unit: 'piece', goinsPrice: 15 },
  { name: 'ESP8266 (NodeMCU)', categories: ['Microcontrollers & Boards'], aliases: ['nodemcu', 'esp8266'], unit: 'piece', goinsPrice: 15 },
  { name: 'Raspberry Pi Pico', categories: ['Microcontrollers & Boards'], aliases: ['pi pico'], unit: 'piece', goinsPrice: 15 },
  { name: 'Servo Motor (SG90)', categories: ['Microcontrollers & Boards', 'Electronics'], aliases: ['sg90', 'servo'], unit: 'piece', goinsPrice: 10 },
  { name: 'DC Motor (Small)', categories: ['Microcontrollers & Boards', 'Electronics'], aliases: ['dc motor'], unit: 'piece', goinsPrice: 10 },
  { name: 'Stepper Motor', categories: ['Microcontrollers & Boards', 'Electronics'], unit: 'piece', goinsPrice: 15 },
  { name: 'Motor Driver Module (L298N)', categories: ['Microcontrollers & Boards'], aliases: ['l298n', 'motor driver'], unit: 'piece', goinsPrice: 15 },
  { name: 'Robot Wheels', categories: ['Microcontrollers & Boards'], aliases: ['robot chassis wheels'], unit: 'pair', goinsPrice: 10 },
  { name: 'Robot Chassis Kit', categories: ['Microcontrollers & Boards', 'Advanced Kits'], unit: 'kit', goinsPrice: 15 },

  // ── Power & Batteries ────────────────────────────────────────────────
  { name: 'AA Batteries', categories: ['Power & Batteries'], unit: 'pack', goinsPrice: 5 },
  { name: 'AAA Batteries', categories: ['Power & Batteries'], unit: 'pack', goinsPrice: 5 },
  { name: '9V Battery', categories: ['Power & Batteries'], unit: 'piece', goinsPrice: 5 },
  { name: 'Coin Cell Battery (CR2032)', categories: ['Power & Batteries'], aliases: ['cr2032', 'button cell'], unit: 'piece', goinsPrice: 5 },
  { name: 'Battery Holder (AA)', categories: ['Power & Batteries'], unit: 'piece', goinsPrice: 5 },
  { name: 'Battery Holder (9V Clip)', categories: ['Power & Batteries'], unit: 'piece', goinsPrice: 5 },
  { name: 'Li-ion Battery (18650)', categories: ['Power & Batteries'], aliases: ['18650'], unit: 'piece', goinsPrice: 10 },
  { name: 'USB Power Bank', categories: ['Power & Batteries'], unit: 'piece', goinsPrice: 15 },
  { name: 'Solar Panel (Small, 5V)', categories: ['Power & Batteries'], aliases: ['solar cell'], unit: 'piece', goinsPrice: 15 },

  // ── Paper & Board ────────────────────────────────────────────────────
  { name: 'Chart Paper', categories: ['Paper & Board'], unit: 'sheet', goinsPrice: 5 },
  { name: 'Craft Paper (Colored)', categories: ['Paper & Board'], unit: 'pack', goinsPrice: 5 },
  { name: 'Tracing Paper', categories: ['Paper & Board'], unit: 'sheet', goinsPrice: 5 },
  { name: 'Graph Paper', categories: ['Paper & Board'], unit: 'sheet', goinsPrice: 5 },
  { name: 'Cardstock Sheets', categories: ['Paper & Board'], unit: 'pack', goinsPrice: 5 },
  { name: 'Corrugated Cardboard Sheet', categories: ['Paper & Board', 'Cardboard & Boxes'], unit: 'sheet', goinsPrice: 5 },
  { name: 'Foam Board (Thermocol Board)', categories: ['Paper & Board', 'Structural & Building Materials'], aliases: ['thermocol', 'foam board'], unit: 'sheet', goinsPrice: 10 },
  { name: 'MDF Board (Thin)', categories: ['Paper & Board', 'Structural & Building Materials'], aliases: ['mdf'], unit: 'sheet', goinsPrice: 10 },
  { name: 'Ply Board (Thin)', categories: ['Paper & Board', 'Structural & Building Materials'], aliases: ['plywood'], unit: 'sheet', goinsPrice: 10 },

  // ── Cardboard & Boxes ────────────────────────────────────────────────
  { name: 'Cardboard Box (Small)', categories: ['Cardboard & Boxes'], unit: 'piece', goinsPrice: 5 },
  { name: 'Cardboard Box (Medium)', categories: ['Cardboard & Boxes'], unit: 'piece', goinsPrice: 5 },
  { name: 'Egg Cartons', categories: ['Cardboard & Boxes'], unit: 'piece', goinsPrice: 5 },
  { name: 'Cardboard Tubes', categories: ['Cardboard & Boxes'], aliases: ['toilet paper rolls', 'paper towel rolls'], unit: 'pack', goinsPrice: 5 },

  // ── Fabric & Craft ───────────────────────────────────────────────────
  { name: 'Felt Sheets (Assorted Colors)', categories: ['Fabric & Craft'], unit: 'pack', goinsPrice: 5 },
  { name: 'Cotton Fabric Scraps', categories: ['Fabric & Craft'], unit: 'pack', goinsPrice: 5 },
  { name: 'Yarn / Wool Thread', categories: ['Fabric & Craft'], aliases: ['wool', 'yarn'], unit: 'roll', goinsPrice: 5 },
  { name: 'Buttons (Assorted)', categories: ['Fabric & Craft'], unit: 'pack', goinsPrice: 5 },
  { name: 'Pom Poms', categories: ['Fabric & Craft'], unit: 'pack', goinsPrice: 5 },
  { name: 'Googly Eyes', categories: ['Fabric & Craft', 'Art & Decoration'], unit: 'pack', goinsPrice: 5 },
  { name: 'Pipe Cleaners', categories: ['Fabric & Craft'], unit: 'pack', goinsPrice: 5 },
  { name: 'Cotton Balls', categories: ['Fabric & Craft'], unit: 'pack', goinsPrice: 5 },

  // ── Art & Decoration ─────────────────────────────────────────────────
  { name: 'Acrylic Paint Set', categories: ['Art & Decoration'], unit: 'set', goinsPrice: 10 },
  { name: 'Poster Colors', categories: ['Art & Decoration'], unit: 'set', goinsPrice: 5 },
  { name: 'Paint Brushes (Assorted)', categories: ['Art & Decoration'], unit: 'pack', goinsPrice: 5 },
  { name: 'Sketch Pens', categories: ['Art & Decoration'], unit: 'pack', goinsPrice: 5 },
  { name: 'Crayons', categories: ['Art & Decoration'], unit: 'pack', goinsPrice: 5 },
  { name: 'Glitter (Assorted Colors)', categories: ['Art & Decoration'], unit: 'pack', goinsPrice: 5 },
  { name: 'Stickers (Assorted)', categories: ['Art & Decoration'], unit: 'pack', goinsPrice: 5 },
  { name: 'Sequins', categories: ['Art & Decoration'], unit: 'pack', goinsPrice: 5 },
  { name: 'Ribbon (Assorted Colors)', categories: ['Art & Decoration'], unit: 'roll', goinsPrice: 5 },

  // ── Tools & Equipment ────────────────────────────────────────────────
  { name: 'Scissors (Kid-Safe)', categories: ['Tools & Equipment'], unit: 'piece', goinsPrice: 5 },
  { name: 'Craft Knife / Hobby Knife', categories: ['Tools & Equipment'], aliases: ['hobby knife', 'x-acto knife'], unit: 'piece', goinsPrice: 10 },
  { name: 'Cutting Mat', categories: ['Tools & Equipment'], unit: 'piece', goinsPrice: 10 },
  { name: 'Ruler', categories: ['Tools & Equipment'], unit: 'piece', goinsPrice: 5 },
  { name: 'Measuring Tape', categories: ['Tools & Equipment'], unit: 'piece', goinsPrice: 5 },
  { name: 'Screwdriver Set (Small)', categories: ['Tools & Equipment'], unit: 'set', goinsPrice: 10 },
  { name: 'Pliers (Small)', categories: ['Tools & Equipment'], unit: 'piece', goinsPrice: 10 },
  { name: 'Wire Stripper', categories: ['Tools & Equipment', 'Electronics'], unit: 'piece', goinsPrice: 10 },
  { name: 'Hand Drill (Small)', categories: ['Tools & Equipment'], unit: 'piece', goinsPrice: 15 },
  { name: 'Sandpaper (Assorted Grit)', categories: ['Tools & Equipment'], unit: 'pack', goinsPrice: 5 },
  { name: 'Clamps (Small)', categories: ['Tools & Equipment'], unit: 'pack', goinsPrice: 10 },

  // ── Science & Chemistry ──────────────────────────────────────────────
  { name: 'Baking Soda', categories: ['Science & Chemistry'], unit: 'pack', goinsPrice: 5 },
  { name: 'Vinegar', categories: ['Science & Chemistry'], unit: 'bottle', goinsPrice: 5 },
  { name: 'Food Coloring', categories: ['Science & Chemistry', 'Art & Decoration'], unit: 'set', goinsPrice: 5 },
  { name: 'Citric Acid', categories: ['Science & Chemistry'], unit: 'pack', goinsPrice: 5 },
  { name: 'Alum (Fitkari)', categories: ['Science & Chemistry'], aliases: ['fitkari'], unit: 'pack', goinsPrice: 5 },
  { name: 'Borax Powder', categories: ['Science & Chemistry'], unit: 'pack', goinsPrice: 5 },
  { name: 'Cornstarch', categories: ['Science & Chemistry'], unit: 'pack', goinsPrice: 5 },
  { name: 'Petri Dish', categories: ['Science & Chemistry'], unit: 'piece', goinsPrice: 5 },
  { name: 'Test Tubes (Set)', categories: ['Science & Chemistry'], unit: 'set', goinsPrice: 10 },
  { name: 'Test Tube Stand', categories: ['Science & Chemistry'], unit: 'piece', goinsPrice: 10 },
  { name: 'Beaker (Plastic, Small)', categories: ['Science & Chemistry'], unit: 'piece', goinsPrice: 5 },
  { name: 'Magnifying Glass', categories: ['Science & Chemistry'], unit: 'piece', goinsPrice: 10 },
  { name: 'Magnets (Bar/Ring, Assorted)', categories: ['Science & Chemistry'], unit: 'pack', goinsPrice: 5 },
  { name: 'Litmus Paper', categories: ['Science & Chemistry'], unit: 'pack', goinsPrice: 5 },
  { name: 'Balloons', categories: ['Science & Chemistry', 'Art & Decoration'], unit: 'pack', goinsPrice: 5 },

  // ── Safety Gear ──────────────────────────────────────────────────────
  { name: 'Safety Goggles', categories: ['Safety Gear'], unit: 'piece', goinsPrice: 5 },
  { name: 'Nitrile Gloves', categories: ['Safety Gear'], aliases: ['disposable gloves'], unit: 'pack', goinsPrice: 5 },
  { name: 'Dust Mask', categories: ['Safety Gear'], unit: 'pack', goinsPrice: 5 },
  { name: 'Craft Apron', categories: ['Safety Gear'], aliases: ['lab apron'], unit: 'piece', goinsPrice: 5 },

  // ── Structural & Building Materials ──────────────────────────────────
  { name: 'Popsicle Sticks', categories: ['Structural & Building Materials'], aliases: ['ice cream sticks', 'craft sticks'], unit: 'pack', goinsPrice: 5 },
  { name: 'Wooden Dowels', categories: ['Structural & Building Materials'], unit: 'pack', goinsPrice: 5 },
  { name: 'Bamboo Skewers', categories: ['Structural & Building Materials'], unit: 'pack', goinsPrice: 5 },
  { name: 'Straws (Plastic/Paper)', categories: ['Structural & Building Materials'], unit: 'pack', goinsPrice: 5 },
  { name: 'PVC Pipes (Small Diameter)', categories: ['Structural & Building Materials'], unit: 'piece', goinsPrice: 10 },
  { name: 'Balsa Wood Sheets', categories: ['Structural & Building Materials'], unit: 'sheet', goinsPrice: 10 },
  { name: 'Foam Sheets (EVA)', categories: ['Structural & Building Materials', 'Art & Decoration'], aliases: ['eva foam'], unit: 'sheet', goinsPrice: 5 },
  { name: 'Clay (Air-Dry)', categories: ['Structural & Building Materials', 'Art & Decoration'], unit: 'pack', goinsPrice: 5 },
  { name: 'Plaster of Paris', categories: ['Structural & Building Materials', 'Science & Chemistry'], aliases: ['pop powder'], unit: 'pack', goinsPrice: 5 },

  // ── 3D Printing & Fabrication ────────────────────────────────────────
  { name: 'PLA Filament (1.75mm)', categories: ['3D Printing & Fabrication'], aliases: ['pla filament', '3d printer filament'], unit: 'spool', goinsPrice: 15 },
  { name: 'ABS Filament (1.75mm)', categories: ['3D Printing & Fabrication'], aliases: ['abs filament'], unit: 'spool', goinsPrice: 15 },

  // ── Advanced Kits ────────────────────────────────────────────────────
  { name: 'Basic Electronics Starter Kit', categories: ['Advanced Kits', 'Electronics'], unit: 'kit', goinsPrice: 15 },
  { name: 'Robotics Starter Kit', categories: ['Advanced Kits', 'Microcontrollers & Boards'], unit: 'kit', goinsPrice: 15 },
  { name: 'Solar Kit (DIY)', categories: ['Advanced Kits', 'Power & Batteries'], unit: 'kit', goinsPrice: 15 },
  { name: 'Simple Machines Kit', categories: ['Advanced Kits'], unit: 'kit', goinsPrice: 15 },
  { name: 'Circuit Building Blocks Kit', categories: ['Advanced Kits', 'Electronics'], unit: 'kit', goinsPrice: 15 },
];

async function main() {
  console.log(`Checking ${CANDIDATES.length} candidate materials against the live catalog...\n`);

  // Every existing material name, lowercased+trimmed, for a safe
  // case-insensitive "does this already exist" check.
  const existing = await prisma.material.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((m) => m.name.trim().toLowerCase()));

  const toAdd: Candidate[] = [];
  const skipped: string[] = [];
  for (const c of CANDIDATES) {
    if (existingNames.has(c.name.trim().toLowerCase())) {
      skipped.push(c.name);
    } else {
      toAdd.push(c);
    }
  }

  console.log(`── Already in your catalog (skipped, ${skipped.length}) ──`);
  if (skipped.length > 0) console.log(skipped.map((n) => `  • ${n}`).join('\n'));
  else console.log('  (none matched)');

  console.log(`\n── Newly added (${toAdd.length}) ──`);
  for (const c of toAdd) {
    const created = await prisma.material.create({
      data: {
        name: c.name,
        category: c.categories[0],
        categories: c.categories,
        aliases: (c.aliases || []).map((a) => a.toLowerCase()),
        unit: c.unit || 'piece',
        goinsPrice: c.goinsPrice,
        showInShop: true,
        showInPlanning: true,
        isActive: true,
        // Deliberately no ASIN/photo/price yet — added blank so Pramod can
        // click "Find" per item in Amazon Setup and choose the best match
        // himself, exactly as requested. amazonNeedsAttention stays false
        // (that flag is reserved for a LINKED item that's since gone
        // stale, not a never-linked one).
      },
    });
    console.log(`  + ${created.name}  [${c.categories.join(', ')}]`);
  }

  console.log(`\n── Category groups ──`);
  for (const g of CATEGORY_GROUPS) {
    const result = await prisma.categoryGroup.upsert({
      where: { name: g.name },
      update: { emoji: g.emoji, memberCategories: g.memberCategories, sortOrder: g.sortOrder },
      create: { name: g.name, emoji: g.emoji, memberCategories: g.memberCategories, sortOrder: g.sortOrder },
    });
    console.log(`  ✓ ${result.emoji} ${result.name}  →  ${result.memberCategories.join(', ')}`);
  }

  console.log(`\nDone. ${toAdd.length} materials added, ${skipped.length} already present and left untouched, ${CATEGORY_GROUPS.length} category groups set up.`);
  console.log(`Next: go to admin.miniguru.in/materials → Amazon Setup, and click "Find" on each newly added item to choose its ASIN.`);
}

main()
  .catch((e) => {
    console.error('Seed script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
