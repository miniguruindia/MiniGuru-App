import { Router, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../utils/prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadMaterialImage, deleteMaterialImage } from '../services/firebaseStorageService';

const router = Router();

// Memory storage (not disk) — we hand the buffer straight to Firebase
// Storage, never touching Cloud Run's ephemeral local disk for this.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — plenty for a material photo
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

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
    const body = req.body || {};
    console.log('[PUT /admin/:id] id:', id, 'body keys:', Object.keys(body));

    // Build update object — only include keys that are present in body
    const data: any = {};
    if ('name'          in body) data.name          = body.name;
    if ('description'   in body) data.description   = body.description;
    if ('imageUrl'      in body) data.imageUrl       = body.imageUrl;
    if ('icon'          in body) data.icon           = body.icon;
    if ('category'      in body) data.category       = body.category;
    if ('unit'          in body) data.unit           = body.unit;
    if ('goinsPrice'    in body) data.goinsPrice     = Number(body.goinsPrice);
    if ('isActive'      in body) data.isActive       = body.isActive;
    if ('showInShop'    in body) data.showInShop     = body.showInShop;
    if ('showInPlanning' in body) data.showInPlanning = body.showInPlanning;
    if ('priceEstimate' in body) data.priceEstimate  = body.priceEstimate ? Number(body.priceEstimate) : null;
    if ('amazonASIN'    in body) {
      const asin = body.amazonASIN ? String(body.amazonASIN).trim() : null;
      data.amazonASIN = asin;
      data.amazonUrl  = asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru08-21') : null;
    }

    console.log('[PUT /admin/:id] data to save:', data);

    const updated = await prisma.material.update({ where: { id }, data });
    console.log('[PUT /admin/:id] saved amazonASIN:', updated.amazonASIN);
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

// ── Direct image upload/replace/delete ───────────────────────────────────────
// Replaces the old manual "download from Drive → resize → drag into
// Firebase Console" workflow. Uploads straight to the same Firebase Storage
// bucket every existing material image already lives in.

router.post(
  '/admin/:id/image',
  authenticateToken,
  requireAdmin,
  imageUpload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!req.file) return res.status(400).json({ error: 'No image file provided (field name: image).' });

      const existing = await prisma.material.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Material not found' });

      // Replacing an existing image? Clean up the old file in Storage so we
      // don't silently accumulate orphaned images every time someone updates
      // a photo (each upload gets a fresh timestamped filename).
      if (existing.imageUrl) {
        await deleteMaterialImage(existing.imageUrl).catch((err) =>
          console.warn('[materials] old image cleanup failed (non-fatal):', err.message)
        );
      }

      const imageUrl = await uploadMaterialImage(req.file.buffer, req.file.mimetype, id);
      const updated = await prisma.material.update({ where: { id }, data: { imageUrl } });
      return res.status(200).json({ message: 'Image uploaded.', imageUrl, material: updated });
    } catch (err: any) {
      console.error('[materials] image upload error:', err);
      return res.status(500).json({ error: err.message || 'Image upload failed.' });
    }
  }
);

router.delete(
  '/admin/:id/image',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await prisma.material.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Material not found' });
      if (!existing.imageUrl) return res.status(200).json({ message: 'No image to remove.' });

      await deleteMaterialImage(existing.imageUrl);
      const updated = await prisma.material.update({ where: { id }, data: { imageUrl: null } });
      return res.status(200).json({ message: 'Image removed.', material: updated });
    } catch (err: any) {
      console.error('[materials] image delete error:', err);
      return res.status(500).json({ error: err.message || 'Image delete failed.' });
    }
  }
);

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