"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLoginIdTaken = isLoginIdTaken;
exports.nextFreeLoginId = nextFreeLoginId;
exports.createUserWithFreeId = createUserWithFreeId;
const prismaClient_1 = __importDefault(require("./prismaClient"));
const DOMAIN = '@miniguru.in';
/** Is this login ID used by another user (case-insensitive) or reserved by a pending sign-up? */
async function isLoginIdTaken(id, excludeUserId) {
    const user = await prismaClient_1.default.user.findFirst({
        where: {
            email: { equals: id, mode: 'insensitive' },
            ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
        },
        select: { id: true },
    });
    if (user)
        return true;
    const pending = await prismaClient_1.default.pendingRegistration.findFirst({
        where: { miniguruId: { equals: id, mode: 'insensitive' } },
        select: { id: true },
    });
    return !!pending;
}
/**
 * "parth.ssm" -> parth.ssm@miniguru.in, else parth2.ssm@, parth3.ssm@ ...
 * The number goes at the end of the first part of the name.
 */
async function nextFreeLoginId(base, excludeUserId) {
    const clean = base.trim().toLowerCase().replace(DOMAIN, '');
    const dot = clean.indexOf('.');
    const first = dot === -1 ? clean : clean.slice(0, dot);
    const rest = dot === -1 ? '' : clean.slice(dot);
    let candidate = `${clean}${DOMAIN}`;
    let n = 2;
    // eslint-disable-next-line no-await-in-loop
    while (await isLoginIdTaken(candidate, excludeUserId)) {
        candidate = `${first}${n}${rest}${DOMAIN}`;
        n += 1;
        if (n > 500)
            throw new Error('Could not allocate a unique MiniGuru ID');
    }
    return candidate;
}
/** Create a user with a free numbered ID; if two requests race, retry with the next free number. */
async function createUserWithFreeId(base, makeData) {
    for (let attempt = 0; attempt < 6; attempt++) {
        const email = await nextFreeLoginId(base);
        try {
            return await prismaClient_1.default.user.create({ data: makeData(email) });
        }
        catch (e) {
            if (e?.code === 'P2002' && String(e?.meta?.target ?? '').toLowerCase().includes('email'))
                continue;
            throw e;
        }
    }
    throw new Error('Could not allocate a unique MiniGuru ID');
}
