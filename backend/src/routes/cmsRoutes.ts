// backend/src/routes/cmsRoutes.ts
// CMS: public GET + admin PUT for site content sections

import express from 'express';
import prisma from '../utils/prismaClient';
import logger from '../logger';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';

const router = express.Router();

const DEFAULTS: Record<string, any> = {
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
    mission: 'MiniGuru empowers Indian children aged 8–14 to become confident creators through hands-on STEAM education.',
    vision: 'A India where every child has access to a maker lab, and where building things with your hands is as celebrated as scoring marks.',
    story: 'MiniGuru was founded by a group of engineers and educators who noticed that India produces world-class coders but few hands-on makers.',
    values: [
      { title: 'Build First', description: 'We believe doing beats watching. Every lesson ends with something made.' },
      { title: 'Fail Forward', description: 'Mistakes are data. We celebrate attempts as much as results.' },
      { title: 'India-Rooted', description: 'Our kits, challenges and content are designed for Indian kids and contexts.' },
      { title: 'Accessible', description: 'Goins and subsidised kits ensure cost is never a barrier to making.' },
    ],
    contactEmail: 'hello@miniguru.in',
    contactPhone: '+91 98765 43210',
    address: 'MiniGuru T-LAB, Mumbai, Maharashtra, India',
  },
  consultancy: {
    tagline: 'Bring the maker movement to your school',
    description: 'MiniGuru partners with schools, NGOs and corporates to set up T-LABs, run STEAM workshops and train educators.',
    services: [
      { title: 'T-LAB Setup', icon: '🏫', description: 'End-to-end design and installation of a maker lab.' },
      { title: 'STEAM Workshops', icon: '🔬', description: 'One-day to week-long workshops by certified MiniGuru mentors.' },
      { title: 'Educator Training', icon: '👩‍🏫', description: 'Professional development for teachers in project-based learning.' },
      { title: 'Corporate CSR', icon: '🤝', description: 'Sponsor T-LABs in government schools. We handle implementation.' },
    ],
    faqs: [
      { question: 'How long does T-LAB setup take?', answer: 'Typically 4–8 weeks from signing to first student session.' },
      { question: 'What is the minimum space required?', answer: 'A dedicated room of at least 400 sq ft is recommended.' },
      { question: 'Do you provide ongoing support?', answer: 'Yes — all T-LAB partners receive curriculum updates and quarterly mentor visits.' },
    ],
    contactEmail: 'schools@miniguru.in',
    contactPhone: '+91 98765 43210',
    formNote: 'Fill in the form and our team will reach out within 2 business days.',
  },
  legal_privacy: "# Privacy Policy\n\n**Last updated: March 2025**\n**MiniGuru India Private Limited**\n\n## 1. Introduction\n\nMiniGuru is committed to protecting the privacy of children and their families. This Privacy Policy explains how we collect, use, store and protect personal information in compliance with India's **Digital Personal Data Protection Act, 2023 (DPDPA)**.\n\n## 2. Data We Collect\n\n- Name, age, email (parent/guardian) — for account creation\n- Phone number — for verification\n- Project uploads (photos, videos) — for platform features\n- Usage data — for personalisation\n- Profile photo (optional)\n\nWe do NOT collect Aadhar numbers, precise location, biometric data or financial card details.\n\n## 3. Parental Consent\n\nUnder DPDPA 2023, processing children's data requires verifiable parental consent. By registering a child you confirm you are their parent/guardian and grant consent.\n\n## 4. Your Rights\n\n- Access, correct or erase your data\n- Withdraw consent at any time\n- Contact: privacy@miniguru.in\n\n## 5. Contact\n\nprivacy@miniguru.in",
  legal_terms: "# Terms and Conditions\n\n**Last updated: March 2025**\n\n## 1. Acceptance\n\nBy using MiniGuru you agree to these Terms. Parents/guardians agree on behalf of children.\n\n## 2. Goins\n\nGoins are virtual currency with no monetary value. They cannot be exchanged for real money.\n\n## 3. Content\n\nStudents retain ownership of their project ideas. By submitting content you grant MiniGuru a licence to display it on the platform.\n\n## 4. Payments\n\nReal-money transactions via Razorpay. Refund requests within 7 days of purchase.\n\n## 5. Governing Law\n\nGoverned by Indian law. Disputes subject to courts in Mumbai, Maharashtra.\n\n## 6. Contact\n\nlegal@miniguru.in",
  legal_child_safety: "# Child Safety Policy\n\n**Last updated: March 2025**\n\n## Our Commitment\n\nMiniGuru is built for children. Child safety is the foundation of everything we do.\n\n## Content Moderation\n\nEvery project video is reviewed by a trained moderator before publication. No child's personal details may appear in published content.\n\n## Reporting\n\n- Use the Report button on any content\n- Email: safety@miniguru.in\n- Response within 24 hours on business days\n\n## POCSO Compliance\n\nMiniGuru complies with POCSO 2012. Any violation will be reported to authorities immediately.\n\n## Contact\n\nsafety@miniguru.in",
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