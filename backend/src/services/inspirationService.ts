// Records "this project was inspired by another child's idea or project" (Nov 2026).
// When a child taps "I'll try this" in the Idea Pool, the app writes a line at the end of the plan:
//   "💡 Inspired by <first name>'s idea MG-XXX-XX-0042"
// At upload we read that line, find the idea or project it points to, and save the link on the new project.
// Nothing in the child's flow changes. Own ideas do not count, only another child's.
import prisma from "../utils/prismaClient";

const LINE = /Inspired by .{1,80}?'s idea (MG-[A-Z]{1,6}-[A-Z]{1,3}-\d{4,})/;

export interface Inspiration { inspiredByCode?: string; inspiredByKind?: "IDEA" | "PROJECT"; inspiredByUserId?: string }

export async function findInspiration(description: string, ownerUserId: string): Promise<Inspiration> {
  try {
    const m = LINE.exec(String(description || ""));
    if (!m) return {};
    const code = m[1];
    const idea = await prisma.idea.findFirst({ where: { code }, select: { makerUserId: true } });
    if (idea) {
      if (String(idea.makerUserId) === String(ownerUserId)) return {};
      return { inspiredByCode: code, inspiredByKind: "IDEA", inspiredByUserId: String(idea.makerUserId) };
    }
    const proj = await prisma.project.findFirst({ where: { planId: code }, select: { userId: true } });
    if (proj) {
      if (String(proj.userId) === String(ownerUserId)) return {};
      return { inspiredByCode: code, inspiredByKind: "PROJECT", inspiredByUserId: String(proj.userId) };
    }
    return {};
  } catch {
    return {}; // never block an upload
  }
}

// Public numbers for the home page: how many published projects, and how many were inspired by another child.
export async function inspirationStats() {
  const total = await prisma.project.count({ where: { status: "published" } });
  const inspired = await prisma.project.count({ where: { status: "published", inspiredByCode: { not: null } } });
  return { total, inspired, percent: total > 0 ? Math.round((inspired * 100) / total) : 0 };
}
