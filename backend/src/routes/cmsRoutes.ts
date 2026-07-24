// backend/src/routes/cmsRoutes.ts
// CMS: public GET + admin PUT for site content sections

import express from 'express';
import prisma from '../utils/prismaClient';
import logger from '../logger';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// Exported so the one-off migration script (seed_about_consultancy_legal_v2.ts)
// can push this exact same content into MongoDB, guaranteeing the DB record
// and this fallback default can never drift apart.
export const DEFAULTS: Record<string, any> = {
  community: {
    happenings: [
      { id: '1', title: 'T-LAB Mumbai Grand Opening', date: '2025-03-15', description: 'Our flagship lab opens its doors to young makers!', imageUrl: '', tag: 'NEW' },
      { id: '2', title: 'STEAM Expo 2025', date: '2025-04-20', description: 'Showcase your projects to parents, mentors and industry experts.', imageUrl: '', tag: 'UPCOMING' },
    ],
    challenges: [
      { id: '1', title: 'Solar Car Challenge', category: 'Engineering', difficulty: 'Medium', goinsReward: 200, endDate: '2025-04-30', status: 'ongoing', description: 'Build a solar-powered vehicle using the kit provided.' },
      { id: '2', title: 'Robotics Blitz', category: 'Robotics', difficulty: 'Hard', goinsReward: 350, endDate: '2025-05-15', status: 'upcoming', description: 'Program a robot to navigate an obstacle course.' },
    ],
    resources: [
      { id: '1', title: 'Getting Started with Electronics', type: 'PDF', tag: 'Beginner', url: '', description: 'A friendly intro to circuits, components and safety.' },
      { id: '2', title: 'Project Planning Template', type: 'DOC', tag: 'Tool', url: '', description: 'Plan your next project step by step.' },
      { id: '3', title: 'MiniGuru Mentor Handbook', type: 'PDF', tag: 'Mentor', url: '', description: 'For teachers and parents guiding young makers.' },
    ],
    ladder: {
      levels: [
        { name: 'Sprout',    minScore: 0,    emoji: '🌱', perks: 'Access to basic challenges' },
        { name: 'Tinkerer',  minScore: 100,  emoji: '🔧', perks: 'Unlock intermediate kits' },
        { name: 'Inventor',  minScore: 300,  emoji: '💡', perks: 'Community mentor badge' },
        { name: 'Builder',   minScore: 600,  emoji: '🏗️', perks: 'Featured on leaderboard' },
        { name: 'Innovator', minScore: 1000, emoji: '🚀', perks: 'Invited to T-LAB events' },
      ]
    }
  },
  about: {
    // These are exactly the two things on the About page that change over
    // time and that the app already reads (see about.dart _HeroText stat
    // chips + _TLabNetworkSection schools list) — everything else on the
    // page (Origin Story, Natural Learning Model, Platform Features,
    // Offerings, Awards) is deliberately kept as hardcoded narrative copy,
    // per an earlier product decision: CMS placeholder text there was
    // worse than the real, specific story already written into the app.
    stats: {
      years:     '10+ Years',
      tlabs:     '32+ T-LABs',
      students:  '10,000+ Students',
      workshops: '200+ Workshops',
    },
    schools: [
      'Jinglebell School, Faizabad UP',
      'Sahyadri School (KFI), Pune MH',
      'TinyTods School, Faizabad UP',
      'Sunbeam School, Mugalsarai UP',
      'Aga Khan Foundation — 17 schools, Bihar',
      'Divine International School, Surat GJ',
      '+ many more T-LABs across India',
    ],
    contactEmail: 'connect@miniguru.in',
    contactPhone: '+91 93997 56846',
    address: 'Ujjain, Madhya Pradesh, India',
  },
  consultancy: {
    // Field names below match exactly what consultancy.dart's _loadCms()
    // actually reads (header tagline + 3 stat blocks + contact + FAQ +
    // T-LAB photos + materials/profile bodies). The old services/
    // description/formNote fields below were editable in admin but never
    // read by the app anywhere — removed so admin only shows fields that
    // genuinely affect the live page. Pricing, process steps, and each
    // tab's detailed copy remain hardcoded narrative content, unchanged.
    tagline: 'T-LAB, home tinkering spaces, and workshops — ' +
             'built around the Natural Learning Model.',
    stats: {
      tlabs: '32+', students: '10,000+', workshops: '200+', experience: '10+ yrs',
    },
    tlabStats: {
      tlabs: '32+', students: '10,000+', running: '10+ yrs',
    },
    workshopStats: {
      done: '200+', participants: '800+', projects: '1500+',
    },
    tlabImages: [],
    materialsBody: '',
    profileBodies: { p1: '', p2: '', p3: '', p4: '' },
    // Home Tinkering Corner tab's Parent FAQ accordion — real current
    // content as the default, editable from admin, same shape the FAQ
    // page already uses (question/answer).
    faqs: [
      { question: "My child doesn't know what they want to make. Is that okay?",
        answer: 'Yes — and it is completely normal. Most children who have spent years ' +
          'in structured school settings have lost practice in following their own ' +
          'curiosity. The first sessions of any tinkering space often involve ' +
          'looking, handling materials, and waiting. This is the beginning of ' +
          'learning, not the absence of it. It passes.' },
      { question: 'What if my child loses interest after a few weeks?',
        answer: "Some children need more time to find the project that captures them. " +
          "If the corner isn't working, we talk through what might be different " +
          '— different materials, a different arrangement, a new project trigger. ' +
          'Our follow-up support is specifically designed for this moment.' },
      { question: 'Is this safe for younger children?',
        answer: 'Yes, with age-appropriate materials. We tailor every materials list ' +
          "to the child's age and supervise the introduction of tools through " +
          'the setup process. All plans include safety guidance for parents. ' +
          'For children under 8, we begin with craft, clay, and basic ' +
          'construction — and introduce electronics and sharp tools gradually.' },
    ],
    contactEmail: 'connect@miniguru.in',
    contactPhone: '+919399756846',
    contactWhatsapp: '919399756846',
  },
  legal_privacy: { title: 'Privacy Policy', lastUpdated: 'June 2026 · MiniGuru Innovation Private Limited', sections: [
    { heading: '1. Introduction', body: "MiniGuru is built for children. Protecting their privacy is our highest responsibility. This policy explains what we collect, why, and how — in compliance with India's Digital Personal Data Protection Act, 2023 (DPDPA)." },
    { heading: '2. What We Collect', body: "- Account info — child's name, age; parent/guardian email and phone\n- Project content — photos and videos uploaded by the child\n- Usage data — screens visited, features used (for personalisation)\n- Profile photo — optional, stored securely\n\nWe do NOT collect Aadhar numbers, precise GPS location, biometric data, or payment card details." },
    { heading: '3. Parental Consent', body: "Under DPDPA 2023, we require verifiable consent from a parent or guardian before creating an account for a child under 18. By registering, you confirm you are the child's parent/guardian." },
    { heading: '4. How We Use Your Data', body: '- To operate the MiniGuru platform\n- To personalise learning recommendations\n- To moderate content for child safety\n- We never sell data to third parties' },
    { heading: '5. Your Rights', body: '- Access — request a copy of your data\n- Correct — update inaccurate information\n- Erase — request deletion of your account and data\n- Withdraw consent — at any time, contact connect@miniguru.in' },
    { heading: '6. Data Security', body: 'All data is encrypted in transit (TLS) and at rest. Access is restricted to authorised MiniGuru staff only.' },
    { heading: '7. Contact', body: 'connect@miniguru.in · +91 93997 56846' },
  ]},
  legal_terms: { title: 'Terms & Conditions', lastUpdated: 'June 2026 · MiniGuru Innovation Private Limited', sections: [
    { heading: '1. Acceptance', body: 'By using MiniGuru you agree to these Terms. Parents and guardians agree on behalf of children under 18.' },
    { heading: '2. Who Can Use MiniGuru', body: "MiniGuru is designed for children aged 8–14. An account requires a parent or guardian's consent and contact details." },
    { heading: '3. Goins — Virtual Currency', body: "- Goins are MiniGuru's virtual currency earned by completing projects, uploading videos, and community participation.\n- Goins have no real monetary value and cannot be exchanged for cash.\n- Goins are a motivation tracker — earned by building, never deducted.\n- Materials are purchased via Amazon affiliate links — no MiniGuru payment needed." },
    { heading: '4. Your Content', body: '- Children retain ownership of their project ideas.\n- By submitting content you grant MiniGuru a non-exclusive licence to display it on the platform.\n- All content is moderated before publication. Inappropriate content will be removed.' },
    { heading: '5. Payments & Refunds', body: '- Real-money transactions are processed via Razorpay.\n- Refund requests must be made within 7 days of purchase.\n- Contact connect@miniguru.in for refund queries.' },
    { heading: '6. Prohibited Conduct', body: '- Sharing personal contact details publicly\n- Uploading content that is not your own work\n- Any behaviour that makes other members feel unsafe' },
    { heading: '7. Governing Law', body: 'Governed by Indian law. Disputes subject to courts in Ujjain, Madhya Pradesh.' },
    { heading: '8. Contact', body: 'connect@miniguru.in' },
  ]},
  legal_child_safety: { title: 'Child Safety Policy', lastUpdated: 'June 2026 · MiniGuru Innovation Private Limited', sections: [
    { heading: 'Our Commitment', body: 'MiniGuru is built for children. Child safety is the foundation of everything we do.' },
    { heading: 'Content Moderation', body: "Every project video is reviewed by a trained MiniGuru moderator before it goes live. No personal details of the child may appear in published content." },
    { heading: 'Reporting a Concern', body: 'Email connect@miniguru.in. We aim to respond within 24 hours on business days.' },
    { heading: 'POCSO Compliance', body: 'MiniGuru complies with the Protection of Children from Sexual Offences Act, 2012 (POCSO). Any violation will be removed immediately and reported to the relevant authorities.' },
    { heading: 'Contact', body: 'connect@miniguru.in' },
  ]},

  // ── NEW ────────────────────────────────────────────────────────────────────
  legal_cookie: { title: 'Cookie Policy', lastUpdated: 'June 2026 · MiniGuru Innovation Private Limited', sections: [
    { heading: '1. What Are Cookies?', body: 'Cookies are small text files stored on your device when you use a website or app. They help us remember your preferences and keep you logged in.' },
    { heading: '2. Cookies We Use', body: 'Essential Cookies\nThese are required for the app to function. They cannot be turned off.\n- auth_token — keeps you logged in securely\n- session_id — tracks your current session\n\nPerformance Cookies\nThese help us understand how the app is used so we can improve it.\n- analytics — anonymous usage statistics (no personal data)\n\nPreference Cookies\nThese remember your settings.\n- theme — your display preferences\n- last_tab — which section you last visited' },
    { heading: '3. No Advertising Cookies', body: 'MiniGuru does not use advertising cookies. We do not track children for commercial profiling.' },
    { heading: '4. Your Choices', body: 'You can clear cookies at any time through your device settings. Note that clearing essential cookies will log you out.' },
    { heading: '5. Contact', body: 'connect@miniguru.in' },
  ]},
  faq: {
    items: [
      { id: '1', question: 'What is MiniGuru?', answer: 'MiniGuru is a STEAM learning platform for Indian children aged 8–14. Kids explore maker domains, build real projects, share videos, and earn Goins.' },
      { id: '2', question: 'What age group is MiniGuru for?', answer: 'MiniGuru is designed for children aged 8 to 14. Younger or older children may still enjoy the platform with parental guidance.' },
      { id: '3', question: 'What are Goins?', answer: "Goins are MiniGuru's motivation and consistency tracker. Your child earns Goins by uploading project videos, and from likes and comments on their projects. Goins celebrate your child's creative journey — the more they build, the more they earn. Goins are never spent or used to buy materials; materials are bought by parents directly through Amazon." },
      { id: '4', question: 'How does the shop work?', answer: 'Your child browses 200+ STEAM materials, adds them to a kit, then taps "Send to Parent". You receive an email with the full list and a one-tap Amazon buy link. No account needed — pay with UPI, COD, or card on Amazon.' },
      { id: '5', question: 'How does my child earn Goins?', answer: 'Goins are earned by completing projects and uploading videos. Goins are a motivation tracker — they show your child\'s progress and dedication. They are never used to buy anything.' },
      { id: '6', question: "Is my child's data safe?", answer: 'Yes. MiniGuru is DPDPA 2023 compliant. We never sell data, never show ads, and all content is moderated before publication. See our Privacy Policy for full details.' },
      { id: '7', question: 'How is content moderated?', answer: 'Every project video is reviewed by a trained MiniGuru moderator before it goes live. No personal details of the child may appear in published content.' },
      { id: '8', question: "Can I delete my child's account?", answer: 'Yes. Email connect@miniguru.in with your registered phone number and we will delete all data within 30 days, as required by DPDPA 2023.' },
    ]
  },
  // ── END NEW ────────────────────────────────────────────────────────────────
  // "More Ideas From Outside" — admin-curated videos NOT uploaded through the
  // MiniGuru app (e.g. pre-app MiniGuru content, inspiring project videos
  // found elsewhere). Shown as a separate labeled row on the home screen,
  // clearly distinct from the app-uploaded student video feed. Each entry
  // just needs a YouTube video ID — thumbnail is derived automatically from
  // YouTube's free thumbnail CDN (img.youtube.com), no API call needed.
  external_videos: {
    videos: [
      // { videoId: 'dQw4w9WgXcQ', title: 'Example title', description: 'Example description', addedAt: '2026-07-01' },
    ],
  },
};

// Public GET
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const record = await (prisma as any).siteContent.findUnique({ where: { key } });
    if (record) return res.json({ key, value: record.value, updatedAt: record.updatedAt });
    if (DEFAULTS[key]) return res.json({ key, value: DEFAULTS[key], updatedAt: null });
    return res.status(404).json({ message: `Content section '${key}' not found` });
  } catch (error) {
    logger.error(`GET /cms/${req.params.key}: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch content' });
  }
});

// Admin PUT (upsert)
router.put('/:key', authenticateToken, authorizeAdmin, async (req: any, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ message: 'value is required' });
    const record = await (prisma as any).siteContent.upsert({
      where:  { key },
      update: { value, updatedBy: req.user?.userId },
      create: { key, value, updatedBy: req.user?.userId },
    });
    logger.info(`CMS '${key}' updated by admin ${req.user?.userId}`);
    return res.json({ success: true, key, updatedAt: record.updatedAt });
  } catch (error) {
    logger.error(`PUT /cms/${req.params.key}: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to save content' });
  }
});

// Admin GET all sections overview
router.get('/', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const all = await (prisma as any).siteContent.findMany({
      select: { key: true, updatedAt: true }
    });
    return res.json({ seeded: all.map((r: any) => r.key), defaults: Object.keys(DEFAULTS) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list content' });
  }
});

export default router;