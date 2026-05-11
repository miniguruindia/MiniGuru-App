/**
 * MiniGuru — CMS Updater v2 (CORRECTED — matches actual Flutter code)
 *
 * about.dart       → 100% hardcoded, no CMS reads → SKIPPED
 * consultancy.dart → only reads: tagline, stats, tlabStats, workshopStats
 * community_screen → reads: stats, happenings
 * legalScreen.dart → reads: legal_privacy, legal_terms
 * faq              → reads: faq sections
 *
 * Run: cd /workspaces/MiniGuru-App/backend && node ../mg_cms_update.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CMS = {

  // ── 1. COMMUNITY ─────────────────────────────────────────────────────────
  community: {
    stats: { makers: '2,400+', videos: '890', labs: '34' },
    happenings: [
      { id: '1', emoji: '🏫', title: 'Sahyadri School T-LAB', city: 'Pune',
        description: 'Students built a solar-powered water purifier in 3 days using scrap materials!',
        tag: 'Featured', tagColor: '#FFD60A', date: 'May 2, 2026' },
      { id: '2', emoji: '🏠', title: "Rohan's Home Corner", city: 'Mumbai',
        description: 'Completed 12 projects this month — youngest maker to hit Builder level!',
        tag: 'Milestone', tagColor: '#10B981', date: 'May 1, 2026' },
      { id: '3', emoji: '🏫', title: 'Vikram Batra School T-LAB', city: 'Ujjain',
        description: '40 students completed their first electronics project — LED circuits from scratch.',
        tag: 'New Lab', tagColor: '#3B82F6', date: 'Apr 28, 2026' },
      { id: '4', emoji: '🏫', title: 'DPS Innovation Lab', city: 'Delhi',
        description: 'Won regional STEAM fair with their MiniGuru robotics project — proud makers!',
        tag: 'Award', tagColor: '#EC4899', date: 'Apr 20, 2026' },
      { id: '5', emoji: '🏫', title: 'Aga Khan Foundation Schools', city: 'Bihar',
        description: '17 government schools running T-LAB — 800+ children making every week.',
        tag: 'Network', tagColor: '#8B5CF6', date: 'Apr 10, 2026' }
    ]
  },

  // ── 2. CONSULTANCY ───────────────────────────────────────────────────────
  // ONLY these 4 fields are read by consultancy.dart — nothing else
  consultancy: {
    tagline: 'T-LAB in schools, home tinkering corners, and STEAM workshops — built around the Natural Learning Model.',
    stats: {
      tlabs: '32+',
      students: '10,000+',
      workshops: '200+',
      experience: '10+ yrs'
    },
    tlabStats: {
      tlabs: '32+',
      students: '10,000+',
      running: '10+ yrs'
    },
    workshopStats: {
      done: '200+',
      participants: '800+',
      projects: '1,500+'
    }
  },

  // ── 3. LEGAL — PRIVACY ───────────────────────────────────────────────────
  legal_privacy: {
    title: 'Privacy Policy',
    lastUpdated: 'April 2026',
    content: 'MiniGuru Innovation Pvt Ltd is committed to protecting the privacy of children and families using our platform. This policy complies with the Digital Personal Data Protection Act 2023 (DPDPA) and POCSO guidelines.\n\nWhat we collect: Name, age, email, phone number, project videos, and Goins activity. For children under 18, parental or guardian consent is mandatory at registration.\n\nHow we use it: To provide the MiniGuru service, review uploaded videos before publishing, award Goins, and send platform notifications.\n\nWhat we never do: We never sell personal data. We never show advertising. We never share data with third parties except YouTube (video hosting) and MongoDB Atlas (secure data storage).\n\nVideos: All child-uploaded videos are reviewed by our team before going public. Videos can be deleted by the child or parent at any time by contacting connect@miniguru.in.\n\nData deletion: Request complete deletion by emailing connect@miniguru.in.\n\nContact: connect@miniguru.in | +91 93997 56846 | 311, Mahamangal City, Ujjain, MP 456010',
    sections: [
      { heading: 'What we collect', body: 'Name, age, email, phone number, project videos, and Goins activity. For children under 18, parental or guardian consent is mandatory at registration.' },
      { heading: 'How we use it', body: 'To provide the MiniGuru service, review uploaded videos before publishing, award Goins, and send platform notifications.' },
      { heading: 'What we never do', body: 'We never sell personal data. We never show advertising. We never share data with third parties except YouTube (video hosting) and MongoDB Atlas (secure data storage).' },
      { heading: 'Videos', body: 'All child-uploaded videos are reviewed by our team before going public. Videos can be deleted at any time by contacting connect@miniguru.in.' },
      { heading: 'Data deletion', body: 'Request complete deletion of your account and all data by emailing connect@miniguru.in.' },
      { heading: 'Compliance', body: 'This policy complies with the Digital Personal Data Protection Act 2023 (DPDPA) and POCSO guidelines.' },
      { heading: 'Contact', body: 'connect@miniguru.in | +91 93997 56846 | 311, Mahamangal City, Ujjain, MP 456010' }
    ]
  },

  // ── 4. LEGAL — TERMS ─────────────────────────────────────────────────────
  legal_terms: {
    title: 'Terms & Conditions',
    lastUpdated: 'April 2026',
    content: "By using MiniGuru, you agree to these terms.\n\nGoins: Goins are a virtual currency with no real monetary value. They cannot be exchanged for cash.\n\nVideos: By uploading a video, you grant MiniGuru a licence to display it on the platform and YouTube channel. You retain ownership.\n\nAcceptable use: Any misuse, bullying, or inappropriate content will result in account suspension.\n\nChildren under 18: Accounts for users under 18 require parent or guardian registration as a Mentor.\n\nWallet: The wallet holds real money paid via Razorpay. Non-refundable once materials are dispatched.\n\nContact: connect@miniguru.in | +91 93997 56846",
    sections: [
      { heading: 'Goins', body: 'Goins are a virtual currency with no real monetary value. They cannot be exchanged for cash or transferred between accounts.' },
      { heading: 'Videos', body: "By uploading a video, you grant MiniGuru a licence to display it on the platform and YouTube channel. You retain ownership. Videos must show original projects." },
      { heading: 'Acceptable use', body: 'MiniGuru is for learning and making. Any misuse, bullying, or inappropriate content will result in immediate account suspension.' },
      { heading: 'Children under 18', body: "Accounts for users under 18 require parent or guardian registration as a Mentor. The parent is responsible for the child's activity on the platform." },
      { heading: 'Wallet', body: 'The wallet holds real money paid via Razorpay for purchasing materials. Wallet balance is separate from Goins and non-refundable once materials are dispatched.' },
      { heading: 'Contact', body: 'connect@miniguru.in | +91 93997 56846 | 311, Mahamangal City, Ujjain, MP 456010' }
    ]
  },

  // ── 5. FAQ ────────────────────────────────────────────────────────────────
  faq: {
    sections: [
      {
        title: 'For Parents',
        questions: [
          { q: 'What age is MiniGuru for?', a: 'Children aged 8–14. Projects and the Goins economy are designed for this age group.' },
          { q: 'Is it safe for my child?', a: 'Yes. All videos are reviewed by admin before going public. DPDPA 2023 + POCSO compliant.' },
          { q: 'What are Goins?', a: "Goins are MiniGuru's virtual currency — not real money. Children earn by completing projects and spend to plan new ones." },
          { q: 'Do I need to buy materials?', a: 'Not necessarily. Many projects use scrap and household items. The Shop has optional materials.' },
          { q: 'How does video approval work?', a: 'Child uploads video → our team reviews within 48 hours → approved videos go public → child earns 50 Goins.' }
        ]
      },
      {
        title: 'For Schools',
        questions: [
          { q: 'How is MiniGuru different from other STEAM apps?', a: 'Children build real physical projects — not simulations. Learning happens with real materials in a T-LAB.' },
          { q: 'What is a T-LAB?', a: 'A Tinkering Lab run by children during free periods and after school. Adults are enablers — not instructors.' },
          { q: 'How many students can use one account?', a: 'School accounts support unlimited student registration with class management and analytics.' },
          { q: 'What does the school subscription include?', a: 'Platform access, admin dashboard, class analytics, bulk registration, and monthly T-LAB support.' }
        ]
      },
      {
        title: 'About Goins',
        questions: [
          { q: 'How do I earn Goins?', a: 'New account: +100. Approved video: +50. Like received: +5. Comment: +10. Peer rating per criterion: +10. Cross-school 2× bonus.' },
          { q: 'What can I spend Goins on?', a: 'Goins are spent when selecting materials for a project — teaches budgeting and planning.' },
          { q: 'Can Goins be converted to real money?', a: 'No. Goins are virtual only. The wallet (real ₹) is completely separate.' }
        ]
      }
    ]
  }
};

async function updateCMS() {
  console.log('\n🚀 MiniGuru CMS Updater v2\n');
  console.log('ℹ️  Skipping "about" — fully hardcoded in about.dart, CMS not read there\n');

  for (const [key, value] of Object.entries(CMS)) {
    try {
      await prisma.siteContent.upsert({
        where:  { key },
        update: { value },
        create: { key, value }
      });
      console.log(`✅  ${key}`);
    } catch (e) {
      console.error(`❌  ${key} — ${e.message}`);
    }
  }

  console.log('\n📋 All CMS keys in DB:');
  const all = await prisma.siteContent.findMany({ select: { key: true } });
  all.forEach(r => console.log(`   • ${r.key}`));
  console.log('\n✅ Done! No Flutter rebuild needed — app reads CMS at runtime.');
  console.log('\n📌 NEXT: To make about.dart CMS-driven, add _loadCms() to AboutScreen.');
  console.log('📌 NEXT: To wire challenges/resources tabs → extend _loadCms() in community_screen.dart\n');
}

updateCMS().finally(() => prisma.$disconnect());
