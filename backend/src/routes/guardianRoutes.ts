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

    const child = await prisma.childProfile.create({
      data: {
        guardianId: userId,
        name,
        age: Number(age),
        grade: grade ?? null,
        pinHash,
      },
      select: {
        id: true, name: true, age: true, grade: true,
        avatar: true, score: true, isActive: true, createdAt: true,
      }
    });

    return res.status(201).json({ message: 'Child added successfully', child });
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

export default router;
