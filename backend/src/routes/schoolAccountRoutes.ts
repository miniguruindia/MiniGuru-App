import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../utils/prismaClient';
import { authenticateToken, authorizeAdmin } from '../middleware/authMiddleware';

const router = Router();

// Every route in this file is admin-only.
router.use(authenticateToken, authorizeAdmin);

// ── Helpers ────────────────────────────────────────────────────────────────
function generatePassword(): string {
  // e.g. "Edu@a1b2c3d4" — easy enough to read/type, ~32 bits of entropy
  return 'Edu@' + crypto.randomBytes(4).toString('hex');
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function slugWord(w: string): string {
  return (w || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Login ID = first word of institution name + first word of city, e.g.
// "Sunrise Public School" in "Ujjain" → sunrise.ujjain@miniguru.in
async function buildUniqueSchoolEmail(institutionName: string, city?: string): Promise<string> {
  const firstWord = slugWord(institutionName.trim().split(/\s+/)[0]) || 'school';
  const cityWord = city ? slugWord(city.trim().split(/\s+/)[0]) : '';
  const base = cityWord ? `${firstWord}.${cityWord}` : firstWord;

  let email = `${base}@miniguru.in`;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.user.findUnique({ where: { email } })) {
    suffix += 1;
    email = `${base}${suffix}@miniguru.in`;
  }
  return email;
}

async function buildUniqueChildEmail(name: string): Promise<string> {
  const base = name.trim().toLowerCase().split(/\s+/).join('.') || 'student';
  let email = `${base}@miniguru.in`;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.user.findUnique({ where: { email } })) {
    email = `${base}${suffix}@miniguru.in`;
    suffix += 1;
  }
  return email;
}

// ── GET /admin/schools — list all School / T-LAB accounts ─────────────────
router.get('/schools', async (req: Request, res: Response) => {
  try {
    const schools = await prisma.user.findMany({
      where: { isMentor: true, mentorType: { in: ['SCHOOL', 'TLAB'] } },
      select: {
        id: true, name: true, email: true, phoneNumber: true, guardianEmail: true,
        mentorType: true, guardianInfo: true, score: true, createdAt: true,
        children: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      schools.map((s: any) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        contactEmail: s.guardianEmail ?? null,
        phoneNumber: s.phoneNumber,
        mentorType: s.mentorType,
        institutionName: s.guardianInfo?.institutionName ?? null,
        city: s.guardianInfo?.city ?? null,
        state: s.guardianInfo?.state ?? null,
        pincode: s.guardianInfo?.pincode ?? null,
        studentCount: s.children?.length ?? 0,
        createdAt: s.createdAt,
      }))
    );
  } catch (e) {
    console.error('List schools error:', e);
    res.status(500).json({ message: 'Failed to fetch school accounts' });
  }
});

// ── GET /admin/schools/:id — single school detail ──────────────────────────
router.get('/schools/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const s = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phoneNumber: true, guardianEmail: true,
        mentorType: true, guardianInfo: true, score: true, createdAt: true,
        children: { select: { id: true } },
      },
    });
    if (!s || !s.mentorType || !['SCHOOL', 'TLAB'].includes(s.mentorType)) {
      return res.status(404).json({ message: 'School/T-LAB account not found' });
    }
    const gi: any = s.guardianInfo ?? {};
    res.json({
      id: s.id,
      name: s.name,
      email: s.email,
      contactEmail: s.guardianEmail ?? null,
      phoneNumber: s.phoneNumber,
      mentorType: s.mentorType,
      institutionName: gi.institutionName ?? null,
      city: gi.city ?? null,
      state: gi.state ?? null,
      pincode: gi.pincode ?? null,
      studentCount: s.children?.length ?? 0,
      createdAt: s.createdAt,
    });
  } catch (e) {
    console.error('Get school error:', e);
    res.status(500).json({ message: 'Failed to fetch school account' });
  }
});

// ── POST /admin/create-school-account ──────────────────────────────────────
router.post('/create-school-account', async (req: Request, res: Response) => {
  try {
    const {
      institutionName, mentorType, contactName, contactPhone, contactEmail, city, state, pincode,
    } = req.body;

    if (!institutionName || !mentorType) {
      return res.status(400).json({ message: 'institutionName and mentorType are required' });
    }
    if (!['SCHOOL', 'TLAB'].includes(mentorType)) {
      return res.status(400).json({ message: 'mentorType must be SCHOOL or TLAB' });
    }

    const email = await buildUniqueSchoolEmail(institutionName, city);
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: contactName || institutionName,
        email,
        phoneNumber: contactPhone || null,
        guardianEmail: contactEmail || null,
        passwordHash,
        age: 30,
        role: 'USER',
        score: 100,
        isMentor: true,
        mentorType,
        guardianInfo: {
          institutionName,
          city: city ?? null,
          state: state ?? null,
          pincode: pincode ?? null,
          isVerified: true,
        },
      },
      select: { id: true, name: true, email: true, guardianEmail: true, mentorType: true, createdAt: true },
    });

    return res.status(201).json({
      message: contactEmail
        ? 'School account created'
        : 'School account created — no contact email set yet, so credential emails cannot be sent until one is added via Edit',
      account: user,
      credentials: { email, password: plainPassword },
    });
  } catch (e) {
    console.error('Create school account error:', e);
    res.status(500).json({ message: 'Failed to create school account' });
  }
});

// ── PUT /admin/schools/:id — edit the school/parent/T-LAB account itself ───
// Covers login email, contact name, phone, password (all optional / leave-blank
// = unchanged) plus the institution-level fields (institutionName, city, state, pincode).
router.put('/schools/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Account not found' });

    const userData: any = {};

    if ('name' in body && body.name) userData.name = body.name;
    if ('phoneNumber' in body) userData.phoneNumber = body.phoneNumber || null;

    if ('email' in body && body.email && body.email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email: body.email } });
      if (taken) return res.status(409).json({ message: 'That login ID is already in use' });
      userData.email = body.email;
    }

    if ('password' in body && body.password && body.password.trim()) {
      userData.passwordHash = await bcrypt.hash(body.password, 10);
    }

    if ('contactEmail' in body) userData.guardianEmail = body.contactEmail || null;

    const currentGi: any = existing.guardianInfo ?? {};
    const guardianInfo = {
      institutionName: 'institutionName' in body ? body.institutionName : currentGi.institutionName ?? null,
      city: 'city' in body ? body.city : currentGi.city ?? null,
      state: 'state' in body ? body.state : currentGi.state ?? null,
      pincode: 'pincode' in body ? body.pincode : currentGi.pincode ?? null,
      isVerified: currentGi.isVerified ?? true,
    };
    userData.guardianInfo = guardianInfo;

    const updated = await prisma.user.update({
      where: { id },
      data: userData,
      select: { id: true, name: true, email: true, phoneNumber: true, guardianEmail: true, guardianInfo: true },
    });

    return res.json({ message: 'Account updated', account: updated });
  } catch (e) {
    console.error('Update school error:', e);
    res.status(500).json({ message: 'Failed to update account' });
  }
});

// ── POST /admin/users/:id/reset-password ───────────────────────────────────
// Generic admin password reset — works for any account (school, parent, child).
router.post('/users/:id/reset-password', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'Account not found' });

    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    return res.json({
      message: 'Password reset',
      credentials: { email: user.email, password: plainPassword },
    });
  } catch (e) {
    console.error('Admin reset password error:', e);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// ── GET /admin/schools/:id/children — list a school's roster ──────────────
router.get('/schools/:id/children', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const children = await prisma.childProfile.findMany({
      where: { guardianId: id, isActive: true },
      select: {
        id: true, name: true, age: true, grade: true, score: true,
        linkedUserId: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const linkedIds = children.map((c: any) => c.linkedUserId).filter(Boolean) as string[];
    const linkedUsers = linkedIds.length
      ? await prisma.user.findMany({
          where: { id: { in: linkedIds } },
          select: { id: true, email: true, phoneNumber: true },
        })
      : [];
    const linkedMap = new Map<string, any>(linkedUsers.map((u: any) => [u.id, u]));

    res.json(
      children.map((c: any) => {
        const linked = c.linkedUserId ? linkedMap.get(c.linkedUserId) : null;
        return {
          id: c.id,
          name: c.name,
          age: c.age,
          grade: c.grade,
          score: c.score,
          createdAt: c.createdAt,
          loginEmail: linked?.email ?? null,
          phoneNumber: linked?.phoneNumber ?? null,
          hasLogin: !!c.linkedUserId,
        };
      })
    );
  } catch (e) {
    console.error('List school children error:', e);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
});

// ── POST /admin/schools/:id/children — admin adds one child to a school ───
router.post('/schools/:id/children', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, age, grade, pin } = req.body;

    if (!name || !age) {
      return res.status(400).json({ message: 'name and age are required' });
    }

    const guardian = await prisma.user.findUnique({ where: { id } });
    if (!guardian || !guardian.isMentor) {
      return res.status(404).json({ message: 'School/T-LAB account not found' });
    }

    const finalPin = pin && /^\d{4}$/.test(String(pin)) ? String(pin) : generatePin();
    const pinHash = await bcrypt.hash(finalPin, 10);

    const email = await buildUniqueChildEmail(name);
    const autoPassword = 'MG' + finalPin;
    const passwordHash = await bcrypt.hash(autoPassword, 10);

    const linkedUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name.trim(),
        age: Number(age),
        phoneNumber: `child_${Date.now()}`,
        role: 'USER',
        score: 100,
        isMentor: false,
      },
    });

    const child = await prisma.childProfile.create({
      data: {
        guardianId: id,
        name: name.trim(),
        age: Number(age),
        grade: grade ?? null,
        pinHash,
        linkedUserId: linkedUser.id,
      },
      select: { id: true, name: true, age: true, grade: true, createdAt: true },
    });

    return res.status(201).json({
      message: 'Student added',
      child,
      credentials: { email, password: autoPassword, pin: finalPin },
    });
  } catch (e) {
    console.error('Admin add child error:', e);
    res.status(500).json({ message: 'Failed to add student' });
  }
});

// ── PUT /admin/children/:childId — edit a student's profile + login ───────
router.put('/children/:childId', async (req: Request, res: Response) => {
  try {
    const { childId } = req.params;
    const body = req.body;

    const child = await prisma.childProfile.findUnique({ where: { id: childId } });
    if (!child) return res.status(404).json({ message: 'Student not found' });

    const childData: any = {};
    if ('name' in body && body.name) childData.name = body.name;
    if ('age' in body && body.age) childData.age = Number(body.age);
    if ('grade' in body) childData.grade = body.grade || null;

    if (Object.keys(childData).length > 0) {
      await prisma.childProfile.update({ where: { id: childId }, data: childData });
    }

    let updatedLogin: any = null;
    if (child.linkedUserId) {
      const userData: any = {};
      if ('name' in body && body.name) userData.name = body.name;
      if ('phoneNumber' in body) userData.phoneNumber = body.phoneNumber || null;
      if ('email' in body && body.email) {
        const taken = await prisma.user.findUnique({ where: { email: body.email } });
        if (taken && taken.id !== child.linkedUserId) {
          return res.status(409).json({ message: 'That login ID is already in use' });
        }
        userData.email = body.email;
      }
      if ('password' in body && body.password && body.password.trim()) {
        userData.passwordHash = await bcrypt.hash(body.password, 10);
      }

      if (Object.keys(userData).length > 0) {
        updatedLogin = await prisma.user.update({
          where: { id: child.linkedUserId },
          data: userData,
          select: { id: true, email: true, phoneNumber: true },
        });
      }
    }

    return res.json({ message: 'Student updated', login: updatedLogin });
  } catch (e) {
    console.error('Update child error:', e);
    res.status(500).json({ message: 'Failed to update student' });
  }
});

// ── POST /admin/children/:childId/reset-password ──────────────────────────
router.post('/children/:childId/reset-password', async (req: Request, res: Response) => {
  try {
    const { childId } = req.params;
    const child = await prisma.childProfile.findUnique({ where: { id: childId } });
    if (!child || !child.linkedUserId) {
      return res.status(404).json({ message: 'No independent login linked to this student' });
    }

    const user = await prisma.user.findUnique({ where: { id: child.linkedUserId } });
    if (!user) return res.status(404).json({ message: 'Linked login account not found' });

    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    await prisma.user.update({ where: { id: child.linkedUserId }, data: { passwordHash } });

    return res.json({
      message: 'Password reset',
      credentials: { email: user.email, password: plainPassword },
    });
  } catch (e) {
    console.error('Reset child password error:', e);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// ── POST /admin/children/:childId/reset-pin ────────────────────────────────
// Resets the parent/teacher "view as" PIN — separate from the student's own login password.
router.post('/children/:childId/reset-pin', async (req: Request, res: Response) => {
  try {
    const { childId } = req.params;
    const child = await prisma.childProfile.findUnique({ where: { id: childId } });
    if (!child) return res.status(404).json({ message: 'Student not found' });

    const pin = generatePin();
    const pinHash = await bcrypt.hash(pin, 10);
    await prisma.childProfile.update({ where: { id: childId }, data: { pinHash } });

    return res.json({ message: 'PIN reset', pin });
  } catch (e) {
    console.error('Reset child PIN error:', e);
    res.status(500).json({ message: 'Failed to reset PIN' });
  }
});

// ── DELETE /admin/children/:childId — soft delete ──────────────────────────
router.delete('/children/:childId', async (req: Request, res: Response) => {
  try {
    const { childId } = req.params;
    const child = await prisma.childProfile.findUnique({ where: { id: childId } });
    if (!child) return res.status(404).json({ message: 'Student not found' });

    await prisma.childProfile.update({ where: { id: childId }, data: { isActive: false } });
    return res.json({ message: 'Student removed' });
  } catch (e) {
    console.error('Delete child error:', e);
    res.status(500).json({ message: 'Failed to remove student' });
  }
});

export default router;