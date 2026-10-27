// backend/src/routes/adminExportRoutes.ts
// Admin-only data downloads (Oct 2026). Mounted at /admin/export.
//   GET /admin/export            list of what can be downloaded
//   GET /admin/export/:dataset   one CSV file (opens in Excel / Google Sheets)
//
// Safety rules:
//  * only fields written below are exported: password hashes, PIN hashes,
//    login tokens, code hashes and email bodies are NEVER included;
//  * nothing is changed by these routes - they only read;
//  * cells that could run as a spreadsheet formula are neutralised.
import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';
import { FRESH_DAYS } from '../utils/emailLog';

const router = Router();
const db: any = prisma;

// ── small helpers ───────────────────────────────────────────────────────────
function istText(d: any): string {
  if (!d) return '';
  const t = new Date(d);
  if (isNaN(t.getTime())) return '';
  const ist = new Date(t.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 16).replace('T', ' ');
}

function cell(v: any): string {
  if (v === null || v === undefined) return '';
  let s = Array.isArray(v) ? v.join('; ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
  // spreadsheet formula protection (keep normal phone numbers like +91... as they are)
  if (/^[=@]/.test(s) || /^[+\-][^0-9\s]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

type Table = { headers: string[]; rows: any[][] };

function toCsv(t: Table): string {
  const lines = [t.headers.map(cell).join(',')];
  for (const r of t.rows) lines.push(r.map(cell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n'; // BOM so Excel shows Hindi and symbols correctly
}

async function userMap(): Promise<Map<string, { name: string; email: string }>> {
  const all = await db.user.findMany({ select: { id: true, name: true, email: true } });
  return new Map(all.map((u: any) => [String(u.id), { name: u.name, email: u.email }]));
}

// ── the datasets ────────────────────────────────────────────────────────────
interface Dataset { label: string; description: string; build: (req: Request) => Promise<Table> }

const datasets: Record<string, Dataset> = {
  users: {
    label: 'Users',
    description: 'Every account: name, login ID, role and type, age, grade, school, city, parent and guardian details, verification, Goins, streak, joined date, and which school/parent each student belongs to.',
    build: async () => {
      const [users, links] = await Promise.all([
        db.user.findMany({
          select: {
            id: true, name: true, email: true, role: true, isMentor: true, mentorType: true, age: true, grade: true,
            schoolName: true, city: true, parentName: true, parentPhone: true, guardianEmail: true, phoneNumber: true,
            emailVerified: true, phoneVerified: true, score: true, currentStreak: true, createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        db.childProfile.findMany({ where: { isActive: true, linkedUserId: { not: null } }, select: { guardianId: true, linkedUserId: true } }),
      ]);
      const byId = new Map<string, any>(users.map((u: any) => [String(u.id), u]));
      const guardianOf = new Map<string, string>();
      const studentCount = new Map<string, number>();
      for (const l of links) {
        guardianOf.set(String(l.linkedUserId), String(l.guardianId));
        studentCount.set(String(l.guardianId), (studentCount.get(String(l.guardianId)) || 0) + 1);
      }
      return {
        headers: ['Name', 'Login ID / email', 'Role', 'Account type', 'Age', 'Grade', 'School name', 'City', 'Parent name', 'Parent phone', 'Guardian email', 'Phone', 'Email verified', 'Phone verified', 'Goins', 'Streak', 'Joined (IST)', 'Belongs to (name)', 'Belongs to (login ID)', 'Number of students', 'User ID'],
        rows: users.map((u: any) => {
          const g = byId.get(guardianOf.get(String(u.id)) || '');
          return [
            u.name, u.email, u.role, u.mentorType ? u.mentorType : (u.isMentor ? 'MENTOR' : 'INDIVIDUAL'), u.age, u.grade, u.schoolName, u.city,
            u.parentName, u.parentPhone, u.guardianEmail, u.phoneNumber, u.emailVerified, u.phoneVerified, u.score, u.currentStreak,
            istText(u.createdAt), g ? g.name : '', g ? g.email : '', studentCount.get(String(u.id)) || '', u.id,
          ];
        }),
      };
    },
  },

  students: {
    label: 'Students of schools and parents',
    description: 'Every school / T-LAB / parent with each student under them: student name, login ID, age, grade, Goins, active or not.',
    build: async () => {
      const [profiles, users] = await Promise.all([
        db.childProfile.findMany({ select: { guardianId: true, name: true, age: true, grade: true, score: true, isActive: true, linkedUserId: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
        userMap(),
      ]);
      return {
        headers: ['School / parent', 'School / parent login ID', 'Student name', 'Student login ID', 'Age', 'Grade', 'Goins', 'Active', 'Added (IST)'],
        rows: profiles.map((p: any) => {
          const g = users.get(String(p.guardianId));
          const c = p.linkedUserId ? users.get(String(p.linkedUserId)) : undefined;
          return [g ? g.name : '', g ? g.email : '', p.name, c ? c.email : '', p.age, p.grade, p.score, p.isActive, istText(p.createdAt)];
        }),
      };
    },
  },

  projects: {
    label: 'Projects',
    description: 'Every project: title, maker, category, status, rejection reason, video link, YouTube status, Goins spent and awarded, dates.',
    build: async () => {
      const [projects, users, cats] = await Promise.all([
        db.project.findMany({
          select: { id: true, title: true, userId: true, categoryId: true, status: true, rejectionReason: true, desiredPrivacyStatus: true, youtubeUploadStatus: true, goinsSpent: true, challengeGoinsAwarded: true, createdAt: true, video: true },
          orderBy: { createdAt: 'asc' },
        }),
        userMap(),
        db.projectCategory.findMany({ select: { id: true, name: true } }),
      ]);
      const catName = new Map<string, string>(cats.map((c: any) => [String(c.id), c.name]));
      return {
        headers: ['Title', 'Maker', 'Maker login ID', 'Category', 'Status', 'Privacy', 'Rejection reason', 'Video link', 'YouTube status', 'Goins spent on materials', 'Challenge Goins awarded', 'Created (IST)', 'Project ID'],
        rows: projects.map((p: any) => {
          const u = users.get(String(p.userId));
          return [p.title, u ? u.name : '', u ? u.email : '', catName.get(String(p.categoryId)) || '', p.status, p.desiredPrivacyStatus, p.rejectionReason, p.video && p.video.url, p.youtubeUploadStatus, p.goinsSpent, p.challengeGoinsAwarded, istText(p.createdAt), p.id];
        }),
      };
    },
  },

  goins: {
    label: 'Goins history',
    description: 'Every Goins earning record: who, how many, why and when.',
    build: async () => {
      const [events, users] = await Promise.all([
        db.goinsEvent.findMany({ select: { id: true, userId: true, amount: true, source: true, reason: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
        userMap(),
      ]);
      return {
        headers: ['When (IST)', 'Name', 'Login ID', 'Goins', 'Source', 'Reason', 'Record ID'],
        rows: events.map((e: any) => {
          const u = users.get(String(e.userId));
          return [istText(e.createdAt), u ? u.name : '(deleted account)', u ? u.email : '', e.amount, e.source, e.reason, e.id];
        }),
      };
    },
  },

  materials: {
    label: 'Materials catalogue',
    description: 'All materials: name, category, unit, Goins price, price estimate, Amazon ASIN, and where each is shown.',
    build: async () => {
      const m = await db.material.findMany({
        select: { id: true, seqId: true, name: true, category: true, unit: true, goinsPrice: true, priceEstimate: true, amazonASIN: true, showInShop: true, showInPlanning: true, isActive: true, variantOf: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      return {
        headers: ['No.', 'Name', 'Category', 'Unit', 'Goins price', 'Price estimate (Rs)', 'Amazon ASIN', 'Shown in shop', 'Shown in planning', 'Active', 'Option of (material ID)', 'Created (IST)', 'Material ID'],
        rows: m.map((x: any) => [x.seqId, x.name, x.category, x.unit, x.goinsPrice, x.priceEstimate, x.amazonASIN, x.showInShop, x.showInPlanning, x.isActive, x.variantOf, istText(x.createdAt), x.id]),
      };
    },
  },

  suggestions: {
    label: 'Material suggestions',
    description: 'What children suggested, status, admin notes and the Amazon match found.',
    build: async () => {
      const s = await db.productSuggestion.findMany({ orderBy: { createdAt: 'asc' } });
      return {
        headers: ['Date (IST)', 'Suggested by', 'Suggestion', 'Status', 'Context', 'Suggested Goins rate', 'Amazon ASIN found', 'Amazon title found', 'Amazon price found', 'Admin note', 'Resolved (IST)', 'Suggestion ID'],
        rows: s.map((x: any) => [istText(x.createdAt), x.childName, x.suggestion, x.status, x.projectContext, x.requestedGoinsPrice, x.amazonAsinFound, x.amazonTitleFound, x.amazonPriceFound, x.adminNotes, istText(x.resolvedAt), x.id]),
      };
    },
  },

  messages: {
    label: 'Contact-form messages (Inbox)',
    description: 'Messages people sent through the contact form, with status and reply date.',
    build: async () => {
      const m = await db.contactMessage.findMany({ orderBy: { createdAt: 'asc' } });
      return {
        headers: ['Date (IST)', 'Name', 'Email', 'Subject', 'Message', 'Source', 'Status', 'Replied (IST)', 'Message ID'],
        rows: m.map((x: any) => [istText(x.createdAt), x.name, x.email, x.subject, x.message, x.source, x.status, istText(x.repliedAt), x.id]),
      };
    },
  },

  emails: {
    label: 'Sent emails (list)',
    description: 'Every email still on the Sent Emails list: when, to, type, reason, subject, status, saved or not. (The email content itself is downloaded one by one from the Sent Emails tab.)',
    build: async (req: Request) => {
      const view = String(req.query.view || 'all');
      const rows = await db.emailLog.findMany({
        select: { id: true, toEmail: true, fromEmail: true, kind: true, reference: true, subject: true, status: true, error: true, saved: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      const stateOf = (r: any) => (r.saved === true ? 'saved' : (Date.now() - new Date(r.createdAt).getTime()) / 86400000 >= FRESH_DAYS ? 'expiring' : 'fresh');
      const list = rows.filter((r: any) => view === 'all' || stateOf(r) === view);
      return {
        headers: ['When (IST)', 'To', 'From', 'Type', 'Reason', 'Subject', 'Status', 'Kept', 'Error', 'Email ID'],
        rows: list.map((r: any) => [istText(r.createdAt), r.toEmail, r.fromEmail, r.kind, r.reference, r.subject, r.status, stateOf(r) === 'saved' ? 'Saved' : stateOf(r) === 'expiring' ? 'Going to be deleted' : 'Fresh', r.error, r.id]),
      };
    },
  },

  contacts: {
    label: 'Email contacts',
    description: 'Every address MiniGuru has written to, with the latest reason, number of emails, first and last date.',
    build: async () => {
      const c = await db.emailContact.findMany({ orderBy: { lastSentAt: 'desc' } });
      return {
        headers: ['Email', 'Latest reason', 'Type', 'Emails sent', 'First (IST)', 'Last (IST)'],
        rows: c.map((x: any) => [x.email, x.lastReference, x.lastKind, x.sentCount, istText(x.firstSentAt), istText(x.lastSentAt)]),
      };
    },
  },
};

// GET /admin/export
router.get('/', authenticateToken, authorizeAdmin, (_req: Request, res: Response) => {
  return res.json({ datasets: Object.entries(datasets).map(([key, d]) => ({ key, label: d.label, description: d.description })) });
});

// GET /admin/export/:dataset
router.get('/:dataset', authenticateToken, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const d = datasets[String(req.params.dataset)];
    if (!d) return res.status(404).json({ message: 'Unknown download.' });
    const table = await d.build(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    console.log(`[admin] export ${req.params.dataset}: ${table.rows.length} rows by ${(req as any).user?.id || '?'}`);
    return res.send(toCsv(table));
  } catch (e: any) {
    console.error('export error:', e);
    return res.status(500).json({ message: 'Could not prepare this download.' });
  }
});

export default router;
