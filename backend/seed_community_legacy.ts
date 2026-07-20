// backend/seed_community_legacy.ts
//
// One-time, ADDITIVE migration: pushes the hardcoded dummy Happenings and
// Challenges (that used to live only as Dart constants in
// community_screen.dart) into the live 'community' CMS record as real,
// admin-editable entries — tagged/labeled as past activities per Pramod's
// decision, not deleted.
//
// Safe to re-run: matches existing entries by `title` and skips any that
// are already present, so it never duplicates and never touches anything
// admin has already added or edited.
//
// Run with ts-node (NOT plain node — MongoDB Atlas SRV DNS resolution
// fails from Codespace with plain node, per Rule 21):
//   cd backend && npx ts-node seed_community_legacy.ts

import prisma from './src/utils/prismaClient';

const LEGACY_HAPPENINGS = [
  {
    title: 'Sunrise School T-LAB',
    city: 'Pune',
    emoji: '🏫',
    description: 'Students built a solar-powered water purifier in just 3 days!',
    tag: 'Past Highlight',
    tagColor: '#6B6B8A',
    date: '2026-03-02',
    imageUrl: '',
  },
  {
    title: "Rohan's Home Corner",
    city: 'Mumbai',
    emoji: '🏠',
    description: 'Completed 12 projects this month — youngest maker to hit Level 3!',
    tag: 'Past Highlight',
    tagColor: '#6B6B8A',
    date: '2026-03-01',
    imageUrl: '',
  },
  {
    title: 'Maker Hub Bengaluru',
    city: 'Bengaluru',
    emoji: '🏢',
    description: 'Opened doors to 40 new young makers from government schools.',
    tag: 'Past Highlight',
    tagColor: '#6B6B8A',
    date: '2026-02-28',
    imageUrl: '',
  },
  {
    title: 'DPS Innovation Lab',
    city: 'Delhi',
    emoji: '🏫',
    description: 'Won regional STEAM fair with their MiniGuru robotics project.',
    tag: 'Past Highlight',
    tagColor: '#6B6B8A',
    date: '2026-02-25',
    imageUrl: '',
  },
];

const LEGACY_CHALLENGES = [
  {
    title: 'Bridge Builder March',
    category: 'Mechanics',
    categoryEmoji: '⚙️',
    difficulty: 'Medium',
    goinsReward: 200,
    endDate: '2026-03-15',
    status: 'past',
    description: 'Build the strongest bridge using only cardboard and rubber bands. Max span: 30cm.',
    participants: 87,
    color: '3B82F6',
  },
  {
    title: 'Solar Science Sprint',
    category: 'Science',
    categoryEmoji: '🔬',
    difficulty: 'Medium',
    goinsReward: 300,
    endDate: '2026-03-20',
    status: 'past',
    description: 'Build a device powered only by sunlight. Anything goes — fan, car, pump!',
    participants: 54,
    color: '10B981',
  },
  {
    title: 'LED Art Festival',
    category: 'ArtCraft',
    categoryEmoji: '🎨',
    difficulty: 'Medium',
    goinsReward: 150,
    endDate: '2026-04-01',
    status: 'past',
    description: 'Create illuminated artwork using LEDs. Judged on creativity and circuit design.',
    participants: 0,
    color: 'EC4899',
  },
];

function withId(item: any) {
  return { id: `legacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...item };
}

async function main() {
  const existing = await (prisma as any).siteContent.findUnique({ where: { key: 'community' } });
  const value: any = existing?.value ?? { happenings: [], challenges: [], resources: [] };

  const happenings: any[] = Array.isArray(value.happenings) ? value.happenings : [];
  const challenges: any[] = Array.isArray(value.challenges) ? value.challenges : [];

  let addedHappenings = 0;
  for (const h of LEGACY_HAPPENINGS) {
    const already = happenings.some((x: any) => x.title === h.title);
    if (!already) {
      happenings.push(withId(h));
      addedHappenings++;
    }
  }

  let addedChallenges = 0;
  for (const c of LEGACY_CHALLENGES) {
    const already = challenges.some((x: any) => x.title === c.title);
    if (!already) {
      challenges.push(withId(c));
      addedChallenges++;
    }
  }

  value.happenings = happenings;
  value.challenges = challenges;
  // resources deliberately untouched — no "past" concept applies there

  await (prisma as any).siteContent.upsert({
    where: { key: 'community' },
    update: { value },
    create: { key: 'community', value },
  });

  console.log(`✅ Seed complete.`);
  console.log(`   Happenings added: ${addedHappenings} (${happenings.length} total now)`);
  console.log(`   Challenges added: ${addedChallenges} (${challenges.length} total now)`);
  console.log(`   Resources untouched (${(value.resources || []).length} total).`);
  console.log(`   All ${addedHappenings + addedChallenges} newly-added items are now editable at admin.miniguru.in/content → Community tab.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
  });
