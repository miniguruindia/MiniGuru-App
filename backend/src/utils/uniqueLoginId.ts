import prisma from './prismaClient';

const DOMAIN = '@miniguru.in';

/** Is this login ID used by another user (case-insensitive) or reserved by a pending sign-up? */
export async function isLoginIdTaken(id: string, excludeUserId?: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      email: { equals: id, mode: 'insensitive' },
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (user) return true;
  const pending = await prisma.pendingRegistration.findFirst({
    where: { miniguruId: { equals: id, mode: 'insensitive' } },
    select: { id: true },
  });
  return !!pending;
}

/**
 * "parth.ssm" -> parth.ssm@miniguru.in, else parth2.ssm@, parth3.ssm@ ...
 * The number goes at the end of the first part of the name.
 */
export async function nextFreeLoginId(base: string, excludeUserId?: string): Promise<string> {
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
    if (n > 500) throw new Error('Could not allocate a unique MiniGuru ID');
  }
  return candidate;
}

/** Create a user with a free numbered ID; if two requests race, retry with the next free number. */
export async function createUserWithFreeId(base: string, makeData: (email: string) => any) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const email = await nextFreeLoginId(base);
    try {
      return await prisma.user.create({ data: makeData(email) });
    } catch (e: any) {
      if (e?.code === 'P2002' && String(e?.meta?.target ?? '').toLowerCase().includes('email')) continue;
      throw e;
    }
  }
  throw new Error('Could not allocate a unique MiniGuru ID');
}
