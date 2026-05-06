import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// ─── POST /mentor/register ───────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, phoneNumber, password, mentorType, institutionName, city, state, pincode, age } = req.body;

    if (!name || !email || !phoneNumber || !password || !mentorType) {
      return res.status(400).json({ message: 'name, email, phoneNumber, password, mentorType are required' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phoneNumber }] }
    });
    if (existing) {
      return res.status(409).json({ message: 'Email or phone already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phoneNumber,
        passwordHash,
        age: age ?? 25,
        isMentor: true,
        mentorType,
        guardianInfo: {
          institutionName: institutionName ?? null,
          city: city ?? null,
          state: state ?? null,
          pincode: pincode ?? null,
          isVerified: false,
        },
      },
      select: {
        id: true, name: true, email: true, phoneNumber: true,
        isMentor: true, mentorType: true, guardianInfo: true,
        score: true, role: true, createdAt: true,
      }
    });

    return res.status(201).json({ message: 'Mentor registered successfully', user });
  } catch (err: any) {
    console.error('mentor register error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /mentor/children ────────────────────────────────────────────────────
router.post('/children', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { name, age, grade, pin } = req.body;

    if (!name || !age || !pin) {
      return res.status(400).json({ message: 'name, age, pin are required' });
    }
    if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ message: 'PIN must be exactly 4 digits' });
    }

    const mentor = await prisma.user.findUnique({ where: { id: userId } });
    if (!mentor || !mentor.isMentor) {
      return res.status(403).json({ message: 'Only mentor accounts can add children' });
    }

    const pinHash = await bcrypt.hash(String(pin), 10);

    // Auto-generate login credentials
    const nameParts = name.trim().toLowerCase().split(' ');
    const baseEmail = nameParts.join('.') + '@miniguru.in';
    // Make email unique if already taken
    const existing = await prisma.user.findUnique({ where: { email: baseEmail } });
    const autoEmail = existing
      ? nameParts.join('.') + '.' + Math.floor(1000 + Math.random() * 9000) + '@miniguru.in'
      : baseEmail;

    // Create real User account for child — password is MG + PIN (6 chars)
    const autoPassword = 'MG' + String(pin);
    const passwordHash = await bcrypt.hash(autoPassword, 10);
    const linkedUser = await prisma.user.create({
      data: {
        email: autoEmail,
        passwordHash,
        name,
        age: Number(age),
        phoneNumber: 'child_' + Date.now(),
        role: 'USER',
        score: 100,
        isMentor: false,
      }
    });

    const child = await prisma.childProfile.create({
      data: {
        guardianId: userId,
        name,
        age: Number(age),
        grade: grade ?? null,
        pinHash,
        linkedUserId: linkedUser.id,
      },
      select: {
        id: true, name: true, age: true, grade: true,
        avatar: true, score: true, isActive: true, createdAt: true,
      }
    });

    return res.status(201).json({
      message: 'Child added successfully',
      child,
      credentials: {
        email: autoEmail,
        password: autoPassword,
        note: 'Child can login independently with these credentials'
      }
    });
  } catch (err: any) {
    console.error('add child error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /mentor/children ─────────────────────────────────────────────────────
router.get('/children', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const children = await prisma.childProfile.findMany({
      where: { guardianId: userId, isActive: true },
      select: {
        id: true, name: true, age: true, grade: true,
        avatar: true, score: true, isActive: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ children });
  } catch (err: any) {
    console.error('get children error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /mentor/children/:childId ───────────────────────────────────────────
router.get('/children/:childId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { childId } = req.params;

    const child = await prisma.childProfile.findFirst({
      where: { id: childId, guardianId: userId, isActive: true },
      select: {
        id: true, name: true, age: true, grade: true,
        avatar: true, score: true, scoreHistory: true,
        isActive: true, createdAt: true, updatedAt: true,
      }
    });

    if (!child) return res.status(404).json({ message: 'Child not found' });

    return res.json({ child });
  } catch (err: any) {
    console.error('get child error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PUT /mentor/children/:childId ───────────────────────────────────────────
router.put('/children/:childId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { childId } = req.params;
    const { name, age, grade, avatar } = req.body;

    const existing = await prisma.childProfile.findFirst({
      where: { id: childId, guardianId: userId }
    });
    if (!existing) return res.status(404).json({ message: 'Child not found' });

    const updated = await prisma.childProfile.update({
      where: { id: childId },
      data: {
        ...(name && { name }),
        ...(age && { age: Number(age) }),
        ...(grade !== undefined && { grade }),
        ...(avatar !== undefined && { avatar }),
      },
      select: {
        id: true, name: true, age: true, grade: true,
        avatar: true, score: true, isActive: true,
      }
    });

    return res.json({ message: 'Child updated', child: updated });
  } catch (err: any) {
    console.error('update child error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /mentor/children/:childId/verify-pin ───────────────────────────────
router.post('/children/:childId/verify-pin', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { childId } = req.params;
    const { pin } = req.body;

    if (!pin) return res.status(400).json({ message: 'PIN is required' });

    const child = await prisma.childProfile.findFirst({
      where: { id: childId, guardianId: userId, isActive: true }
    });
    if (!child) return res.status(404).json({ message: 'Child not found' });

    const valid = await bcrypt.compare(String(pin), child.pinHash);
    if (!valid) return res.status(401).json({ message: 'Incorrect PIN' });

    return res.json({
      valid: true,
      child: {
        id: child.id, name: child.name, age: child.age,
        grade: child.grade, avatar: child.avatar, score: child.score,
      }
    });
  } catch (err: any) {
    console.error('verify pin error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── DELETE /mentor/children/:childId (soft delete) ──────────────────────────
router.delete('/children/:childId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { childId } = req.params;

    const existing = await prisma.childProfile.findFirst({
      where: { id: childId, guardianId: userId }
    });
    if (!existing) return res.status(404).json({ message: 'Child not found' });

    await prisma.childProfile.update({
      where: { id: childId },
      data: { isActive: false }
    });

    return res.json({ message: 'Child profile deactivated' });
  } catch (err: any) {
    console.error('delete child error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


// ─── Helpers ─────────────────────────────────────────────────────────────────
function getSchoolCode(name: string): string {
  return name.split(/\s+/).map((w: string) => w[0]?.toLowerCase() || '').join('').slice(0, 4);
}
function getCityCode(city: string): string {
  return city.toLowerCase().replace(/\s+/g, '').slice(0, 3);
}

// ─── POST /mentor/children/bulk ───────────────────────────────────────────────
router.post('/children/bulk', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { children } = req.body;

    if (!Array.isArray(children) || children.length === 0)
      return res.status(400).json({ message: 'children array required' });
    if (children.length > 100)
      return res.status(400).json({ message: 'Maximum 100 children per batch' });

    const mentor = await prisma.user.findUnique({
      where: { id: userId },
      select: { isMentor: true, mentorType: true, guardianInfo: true }
    });
    if (!mentor?.isMentor)
      return res.status(403).json({ message: 'Only mentor accounts can bulk add children' });

    const gi = mentor.guardianInfo as any;
    const schoolCode = gi?.institutionName ? getSchoolCode(gi.institutionName) : 'mg';
    const cityCode   = gi?.city           ? getCityCode(gi.city)              : 'in';
    const year       = new Date().getFullYear();
    const results    = [];

    for (const row of children) {
      const { childName, parentName, parentPhone, grade } = row;
      if (!childName?.trim()) continue;

      const firstName     = childName.trim().split(' ')[0].toLowerCase();
      const parentInitial = (parentName?.trim()?.[0] ?? 'x').toLowerCase();
      const baseEmail     = `${firstName}${parentInitial}.${schoolCode}.${cityCode}@miniguru.in`;

      let email = baseEmail; let counter = 2;
      while (await prisma.user.findUnique({ where: { email } })) {
        email = `${firstName}${parentInitial}${counter}.${schoolCode}.${cityCode}@miniguru.in`;
        counter++;
      }

      const displayFirst = childName.trim().split(' ')[0];
      const password     = `${displayFirst}@${year}`;
      const pin          = parentPhone
        ? String(parentPhone).replace(/\D/g, '').slice(-4).padStart(4, '1')
        : '1234';

      const passwordHash = await bcrypt.hash(password, 10);
      const pinHash      = await bcrypt.hash(pin, 10);

      const linkedUser = await prisma.user.create({
        data: {
          email, passwordHash,
          name: childName.trim(),
          age: 10,
          phoneNumber: `child_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          role: 'USER', score: 100, isMentor: false,
        }
      });

      await prisma.childProfile.create({
        data: {
          guardianId: userId,
          name: childName.trim(),
          age: 10,
          grade: grade ?? null,
          pinHash,
          linkedUserId: linkedUser.id,
        }
      });

      results.push({
        childName: childName.trim(),
        parentName: parentName ?? '',
        grade: grade ?? '',
        loginEmail: email,
        password,
        pin,
      });
    }

    return res.status(201).json({ message: `${results.length} children added`, results });
  } catch (err: any) {
    console.error('bulk add error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

export default router;
