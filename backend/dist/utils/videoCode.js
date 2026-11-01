"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.newVideoCode = newVideoCode;
exports.ensureVideoCodes = ensureVideoCodes;
// Short video ID: MG-V-XXXX (letters/numbers without look-alikes). Unique by lookup.
const prismaClient_1 = __importDefault(require("./prismaClient"));
const ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const db = prismaClient_1.default;
function rand4() {
    let s = '';
    for (let i = 0; i < 4; i++)
        s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return `MG-V-${s}`;
}
async function newVideoCode() {
    for (let i = 0; i < 10; i++) {
        const c = rand4();
        const hit = await db.project.findFirst({ where: { videoCode: c }, select: { id: true } });
        if (!hit)
            return c;
    }
    return undefined;
}
/** Gives a code to published projects that have none yet (the first 41 videos, and any older ones). */
async function ensureVideoCodes(limit = 100) {
    try {
        const rows = await db.project.findMany({
            where: { status: 'published', OR: [{ videoCode: null }, { videoCode: { isSet: false } }] },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
        for (const r of rows) {
            const c = await newVideoCode();
            if (c)
                await db.project.update({ where: { id: r.id }, data: { videoCode: c } });
        }
    }
    catch (e) {
        console.warn('ensureVideoCodes (non-fatal):', e?.message || e);
    }
}
