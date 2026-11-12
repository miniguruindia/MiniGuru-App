"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findInspiration = findInspiration;
exports.inspirationStats = inspirationStats;
// Records "this project was inspired by another child's idea or project" (Nov 2026).
// When a child taps "I'll try this" in the Idea Pool, the app writes a line at the end of the plan:
//   "💡 Inspired by <first name>'s idea MG-XXX-XX-0042"
// At upload we read that line, find the idea or project it points to, and save the link on the new project.
// Nothing in the child's flow changes. Own ideas do not count, only another child's.
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const LINE = /Inspired by .{1,80}?'s idea (MG-[A-Z]{1,6}-[A-Z]{1,3}-\d{4,})/;
async function findInspiration(description, ownerUserId) {
    try {
        const m = LINE.exec(String(description || ""));
        if (!m)
            return {};
        const code = m[1];
        const idea = await prismaClient_1.default.idea.findFirst({ where: { code }, select: { makerUserId: true } });
        if (idea) {
            if (String(idea.makerUserId) === String(ownerUserId))
                return {};
            return { inspiredByCode: code, inspiredByKind: "IDEA", inspiredByUserId: String(idea.makerUserId) };
        }
        const proj = await prismaClient_1.default.project.findFirst({ where: { planId: code }, select: { userId: true } });
        if (proj) {
            if (String(proj.userId) === String(ownerUserId))
                return {};
            return { inspiredByCode: code, inspiredByKind: "PROJECT", inspiredByUserId: String(proj.userId) };
        }
        return {};
    }
    catch {
        return {}; // never block an upload
    }
}
// Public numbers for the home page: how many published projects, and how many were inspired by another child.
async function inspirationStats() {
    const total = await prismaClient_1.default.project.count({ where: { status: "published" } });
    const inspired = await prismaClient_1.default.project.count({ where: { status: "published", inspiredByCode: { not: null } } });
    return { total, inspired, percent: total > 0 ? Math.round((inspired * 100) / total) : 0 };
}
