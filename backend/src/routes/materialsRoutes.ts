import { Router, Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

function requireAdmin(req: Request, res: Response, next: Function) {
  const role = (req as any).user?.role;
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function toFlutterShape(m: any) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    imageUrl: m.imageUrl,
    icon: m.icon,
    categoryName: m.category,
    categoryId: m.category.toLowerCase().replace(/\s+/g, '_'),
    category: m.category,
    unit: m.unit || 'piece',
    goinsPerUnit: m.goinsPrice,
    goinsPrice: m.goinsPrice,
    price: m.goinsPrice,
    isAvailable: m.isActive,
    isActive: m.isActive,
    priceEstimate: m.priceEstimate,
    amazonASIN: m.amazonASIN,
    amazonUrl: m.amazonUrl,
    showInShop: m.showInShop,
    showInPlanning: m.showInPlanning,
    createdAt: m.createdAt,
  };
}

// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, categoryId } = req.query;
    const where: any = { isActive: true };
    if (category) {
      where.category = String(category);
    } else if (categoryId) {
      const slug = String(categoryId).replace(/_/g, ' ');
      where.category = { equals: slug, mode: 'insensitive' };
    }
    const materials = await prisma.material.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(materials.map(toFlutterShape));
  } catch (err) {
    console.error('[materials] GET / error:', err);
    res.status(500).json({ message: 'Failed to fetch materials.' });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const results = await prisma.material.findMany({
      where: { isActive: true },
      select: { category: true, icon: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    const categories = results.map((r) => ({
      id: r.category.toLowerCase().replace(/\s+/g, '_'),
      name: r.category,
      emoji: r.icon || '📦',
    }));
    res.json(categories);
  } catch (err) {
    console.error('[materials] GET /categories error:', err);
    res.status(500).json({ message: 'Failed to fetch material categories.' });
  }
});

// ── ADMIN ROUTES — must come before /:id ─────────────────────────────────────

router.get('/admin/all', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const materials = await prisma.material.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

router.post('/admin/create', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, icon, category, unit, goinsPrice,
            priceEstimate, amazonASIN, showInShop, showInPlanning } = req.body;
    if (!name || !category || goinsPrice === undefined) {
      return res.status(400).json({ error: 'name, category, and goinsPrice are required' });
    }
    const asin = amazonASIN ? String(amazonASIN).trim() : null;
    const material = await prisma.material.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        icon: icon ? String(icon).trim() : null,
        category: String(category).trim(),
        unit: unit ? String(unit).trim() : 'piece',
        goinsPrice: Number(goinsPrice),
        priceEstimate: priceEstimate ? Number(priceEstimate) : null,
        amazonASIN: asin,
        amazonUrl: asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru08-21') : null,
        showInShop: showInShop !== undefined ? Boolean(showInShop) : true,
        showInPlanning: showInPlanning !== undefined ? Boolean(showInPlanning) : true,
      },
    });
    res.status(201).json(material);
  } catch (err) {
    console.error('[materials] POST /admin/create error:', err);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

router.put('/admin/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, icon, category, unit, goinsPrice, isActive,
            priceEstimate, amazonASIN, showInShop, showInPlanning } = req.body;
    const asin = amazonASIN !== undefined
      ? (amazonASIN ? String(amazonASIN).trim() : null)
      : undefined;
    const updated = await prisma.material.update({
      where: { id },
      data: {
        ...(name          !== undefined && { name }),
        ...(description   !== undefined && { description }),
        ...(imageUrl      !== undefined && { imageUrl }),
        ...(icon          !== undefined && { icon }),
        ...(category      !== undefined && { category }),
        ...(unit          !== undefined && { unit }),
        ...(goinsPrice    !== undefined && { goinsPrice: Number(goinsPrice) }),
        ...(isActive      !== undefined && { isActive }),
        ...(priceEstimate !== undefined && { priceEstimate: priceEstimate ? Number(priceEstimate) : null }),
        ...(asin          !== undefined && { amazonASIN: asin }),
        ...(asin          !== undefined && { amazonUrl: asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru08-21') : null }),
        ...(showInShop    !== undefined && { showInShop }),
        ...(showInPlanning !== undefined && { showInPlanning }),
      },
    });
    return res.json(updated);
  } catch (err: any) {
    console.error('material update error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.material.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Material deactivated' });
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Material not found' });
    res.status(500).json({ error: 'Failed to deactivate material' });
  }
});

router.post('/admin/bulk', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { materials } = req.body;
    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: 'Body must be { materials: [...] }' });
    }
    const results = { created: 0, skipped: 0, errors: [] as { row: number; name: string; error: string }[] };
    for (let i = 0; i < materials.length; i++) {
      const m = materials[i];
      try {
        if (!m.name || !m.category || m.goinsPrice === undefined) {
          results.errors.push({ row: i + 1, name: m.name || '(unnamed)', error: 'Missing name, category, or goinsPrice' });
          results.skipped++; continue;
        }
        const existing = await prisma.material.findFirst({
          where: { name: String(m.name).trim(), category: String(m.category).trim() },
        });
        if (existing) {
          results.errors.push({ row: i + 1, name: m.name, error: 'Already exists — skipped' });
          results.skipped++; continue;
        }
        const asin = m.amazonASIN ? String(m.amazonASIN).trim() : null;
        await prisma.material.create({
          data: {
            name: String(m.name).trim(),
            description: m.description ? String(m.description).trim() : null,
            imageUrl: m.imageUrl ? String(m.imageUrl).trim() : null,
            icon: m.icon ? String(m.icon).trim() : null,
            category: String(m.category).trim(),
            unit: m.unit ? String(m.unit).trim() : 'piece',
            goinsPrice: Number(m.goinsPrice),
            priceEstimate: m.priceEstimate != null ? Number(m.priceEstimate) : null,
            amazonASIN: asin,
            amazonUrl: asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru08-21') : null,
            showInShop: m.showInShop !== undefined ? Boolean(m.showInShop) : true,
            showInPlanning: m.showInPlanning !== undefined ? Boolean(m.showInPlanning) : true,
          },
        });
        results.created++;
      } catch (rowErr: any) {
        results.errors.push({ row: i + 1, name: m.name || '(unnamed)', error: rowErr.message });
        results.skipped++;
      }
    }
    res.status(201).json(results);
  } catch (err) {
    console.error('[materials] POST /admin/bulk error:', err);
    res.status(500).json({ error: 'Bulk upload failed' });
  }
});

// ── GET /:id — PUBLIC, must be LAST ──────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
    });
    if (!material || !material.isActive) {
      return res.status(404).json({ message: 'Material not found' });
    }
    res.json(toFlutterShape(material));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch material' });
  }
});

export default router;