import { Router, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../utils/prismaClient';
import { authenticateToken, authenticateTokenOptional } from '../middleware/authMiddleware';
import { uploadMaterialImage, deleteMaterialImage } from '../services/firebaseStorageService';
import { searchAmazonProducts, buildAffiliateUrl, getAmazonItemsWithSeller, extractAsinFromUrl } from '../services/amazonProductService';
import { refineSearchQuery } from '../services/materialSearchAssistService';
import { aiFindMaterials, isAllowedImageMime } from '../services/shopAiSearchService';
import { checkShopAiQuota, recordShopAiSearch, checkGuestAmazonFind, recordGuestAmazonFind } from '../utils/costTracking';
import { autoGoinsFor } from '../utils/goinsPricing';
import {
  runAmazonSuggestionScan,
  runAmazonRefreshCheck,
  runPhotoAudit,
  runMaterialsMaintenance,
  amazonImageKey,
  MAINTENANCE_KEY,
  approveAmazonSuggestion,
  rejectAmazonSuggestion,
} from '../services/amazonSuggestionService';

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
  const categories: string[] = (m.categories && m.categories.length > 0) ? m.categories : [m.category];
  // imageUrl (the legacy single field) is ALWAYS the first/primary photo
  // and is authoritative — older write paths (the single-photo upload,
  // Amazon approval, plain PUT with imageUrl) only ever touch that field,
  // so putting it first here guarantees a stale images[] can never make
  // the wrong photo show as the primary one. Any extra photos follow it.
  const extraImages: string[] = (m.images || []).filter((i: string) => i && i !== m.imageUrl);
  const images: string[] = m.imageUrl ? [m.imageUrl, ...extraImages] : extraImages;
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    imageUrl: m.imageUrl,
    icon: m.icon,
    categoryName: m.category,
    categoryId: m.category.toLowerCase().replace(/\s+/g, '_'),
    category: m.category,
    // Full multi-category/multi-image picture, additive — old Flutter
    // builds that only ever read `category`/`imageUrl` above keep working
    // exactly as before; a build that knows about these gets the rest.
    categories,
    categoryIds: categories.map((c) => c.toLowerCase().replace(/\s+/g, '_')),
    images,
    aliases: m.aliases || [],
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
    amazonNeedsAttention: m.amazonNeedsAttention || false,
    goinsLocked: m.goinsLocked === true,
    variantOf: m.variantOf || null,
    amazonAttentionReason: m.amazonAttentionReason || null,
    amazonLastCheckedAt: m.amazonLastCheckedAt,
    createdAt: m.createdAt,
  };
}

// Keeps the legacy single-value fields (`category`, `imageUrl`) in lock
// step with the new arrays whenever an admin write touches either array —
// every existing reader of the singular fields (shop cards, the planning
// picker, the video materials strip, etc.) keeps seeing a sensible value
// with zero changes required on their end. Mutates `data` in place.
function syncLegacyFields(data: any) {
  if (Array.isArray(data.categories) && data.categories.length > 0) {
    data.category = data.categories[0];
  }
  if (Array.isArray(data.images)) {
    // Even an emptied list counts: removing every photo must clear the
    // primary too, otherwise the old one would keep showing (imageUrl is
    // authoritative first in toFlutterShape above).
    data.imageUrl = data.images.length > 0 ? data.images[0] : null;
  }
}

// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, categoryId, search } = req.query;
    const where: any = { isActive: true };
    const clauses: any[] = [];
    if (category) {
      // Matches either the legacy primary category OR membership in the
      // full categories[] array — so a material added to more than one
      // category shows up under any of them, not just its first/primary.
      clauses.push({ OR: [{ category: String(category) }, { categories: { has: String(category) } }] });
    } else if (categoryId) {
      const slug = String(categoryId).replace(/_/g, ' ');
      clauses.push({
        OR: [
          { category: { equals: slug, mode: 'insensitive' } },
          { categories: { has: slug } },
        ],
      });
    }
    if (search && String(search).trim()) {
      // Name substring match (case-insensitive) OR an exact alternate-name
      // hit — e.g. searching "sticky tape" finds a material actually named
      // "Cello Tape" if "sticky tape" was saved as one of its aliases.
      const term = String(search).trim();
      clauses.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { aliases: { has: term.toLowerCase() } },
        ],
      });
    }
    if (clauses.length > 0) where.AND = clauses;

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

// POST /materials/ai-search  body: { query?: string, imageBase64?: string, mimeType?: string }
// Logged-in users only. Returns up to 3 catalog items Gemini thinks match.
// The photo is processed in memory for this one request and never stored.
router.post('/ai-search', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 200) : '';
    const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64 : '';
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'image/jpeg';
    if (!query && !imageBase64) return res.status(400).json({ error: 'Type a name or send a photo.' });
    if (imageBase64 && imageBase64.length > 1_500_000) {
      return res.status(413).json({ error: 'That photo is too big. Please try a smaller one.' });
    }
    if (imageBase64 && !isAllowedImageMime(mimeType)) {
      return res.status(400).json({ error: 'Please use a JPEG, PNG or WebP photo.' });
    }

    const quota = await checkShopAiQuota(userId);
    if (!quota.allowed) {
      return res.status(429).json({
        error: quota.reason === 'user'
          ? 'You have used all your AI searches for today. Try again tomorrow, or use the normal search.'
          : 'AI search is very busy today. Please try again tomorrow, or use the normal search.',
      });
    }
    await recordShopAiSearch(userId);

    const result = await aiFindMaterials({ query, imageBase64: imageBase64 || undefined, mimeType });
    if (result.matches.length === 0) {
      return res.json({
        materials: [],
        message: result.failed
          ? 'AI search is resting right now. Please try the normal search.'
          : 'No close match found. Try other words, or a clearer photo.',
      });
    }
    const rows = await prisma.material.findMany({
      where: { id: { in: result.matches.map((m) => m.id) }, isActive: true },
    });
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    const materials = result.matches
      .filter((m) => byId.has(m.id))
      .map((m) => ({ ...toFlutterShape(byId.get(m.id)), aiReason: m.reason }));
    res.json({ materials });
  } catch (err) {
    console.error('[materials] POST /ai-search error:', err);
    res.status(500).json({ error: 'AI search is not available right now.' });
  }
});

// POST /materials/amazon-find  body: { query }
// "Can't find it?": real Amazon India products for the words, cheapest first,
// with seller, rating and a "Best pick". Works for visitors too (small daily
// allowance). Results are remembered for 6 hours so repeats cost nothing. When
// the allowance or Amazon is not available, a plain tagged Amazon search link
// (fallbackUrl) is always returned so the child can still go on.
const AMAZON_FIND_CACHE_KEY = 'amazon_find_cache';
const AMAZON_FIND_TTL_MS = 6 * 60 * 60 * 1000;

function amazonSearchUrl(q: string): string {
  const tag = process.env.AMAZON_CREATORS_PARTNER_TAG || 'miniguru04-21';
  return 'https://www.amazon.in/s?k=' + encodeURIComponent(q) + '&tag=' + encodeURIComponent(tag);
}

async function readFindCache(norm: string): Promise<any | null> {
  try {
    const row = await prisma.siteContent.findUnique({ where: { key: AMAZON_FIND_CACHE_KEY } });
    const hit = (row?.value as any)?.entries?.[norm];
    if (hit && Date.now() - hit.at < AMAZON_FIND_TTL_MS) return hit.payload;
  } catch { /* no cache */ }
  return null;
}

async function writeFindCache(norm: string, payload: any): Promise<void> {
  try {
    const row = await prisma.siteContent.findUnique({ where: { key: AMAZON_FIND_CACHE_KEY } });
    const entries: Record<string, any> = { ...(((row?.value as any)?.entries) || {}) };
    entries[norm] = { at: Date.now(), payload };
    const keys = Object.keys(entries).sort((x, y) => entries[y].at - entries[x].at).slice(0, 60);
    const trimmed: Record<string, any> = {};
    for (const k of keys) trimmed[k] = entries[k];
    await prisma.siteContent.upsert({
      where: { key: AMAZON_FIND_CACHE_KEY },
      update: { value: { entries: trimmed } },
      create: { key: AMAZON_FIND_CACHE_KEY, value: { entries: trimmed } },
    });
  } catch { /* cache is optional */ }
}

// "pack of 5", "set of 12", "50 pcs" -> 5, 12, 50
function packCount(unitText: string | null | undefined): number | null {
  if (!unitText) return null;
  if (!/pack|set|pcs|pieces|pc|count/i.test(unitText)) return null;
  const m = unitText.match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : 0;
  return n >= 2 && n <= 500 ? n : null;
}

router.post('/amazon-find', authenticateTokenOptional, async (req: any, res: Response) => {
  const rawQuery = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 120) : '';
  const fallbackUrl = amazonSearchUrl(rawQuery);
  try {
    if (rawQuery.length < 2) return res.status(400).json({ error: 'Type what you are looking for.' });
    const norm = rawQuery.toLowerCase().replace(/\s+/g, ' ');

    const cached = await readFindCache(norm);
    if (cached) return res.json({ ...cached, fallbackUrl, cached: true });

    const userId = req.user?.userId;
    let ipHash = '';
    let quota: { allowed: boolean; reason?: string };
    if (userId) {
      quota = await checkShopAiQuota(userId);
    } else {
      const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
      ipHash = require('crypto').createHash('sha256').update(ip).digest('hex').slice(0, 16);
      quota = await checkGuestAmazonFind(ipHash);
    }
    if (!quota.allowed) {
      return res.status(429).json({
        error: quota.reason === 'site'
          ? 'MiniGuru AI search is very busy today.'
          : userId
            ? 'You have used all your MiniGuru AI searches for today.'
            : 'You have used the free searches for today. Log in for more.',
        fallbackUrl,
        limitReached: true,
      });
    }
    if (userId) await recordShopAiSearch(userId); else await recordGuestAmazonFind(ipHash);

    // Plain search first (no AI). Only if it finds very little do we ask Gemini for a better phrase.
    let found = await searchAmazonProducts(rawQuery, 10);
    if (!found.configured) {
      return res.json({ results: [], message: 'Amazon search is not available right now.', fallbackUrl });
    }
    let list: any[] = (found.results || []).filter((r: any) => r.available !== false);
    let searchedFor = rawQuery;
    if (list.length < 3) {
      try {
        const refined = await refineSearchQuery(rawQuery, undefined, undefined, []);
        if (refined && refined.toLowerCase() !== norm) {
          const f2 = await searchAmazonProducts(refined, 10);
          const seen = new Set(list.map((r: any) => r.asin));
          for (const r of (f2.results || [])) if (r.available !== false && !seen.has(r.asin)) list.push(r);
          searchedFor = refined;
        }
      } catch { /* keep the plain results */ }
    }
    list.sort((a: any, b: any) => (a.priceRupees ?? Infinity) - (b.priceRupees ?? Infinity));
    list = list.slice(0, 6);
    if (list.length) {
      const more = await getAmazonItemsWithSeller(list.map((a: any) => a.asin));
      const byAsin = new Map<string, any>((more.results || []).map((r: any) => [r.asin, r]));
      list = list.map((a: any) => ({ ...a, ...(byAsin.get(a.asin) || {}) }));
    }
    // Hide poorly rated items unless the seller is trusted.
    list = list.filter((r: any) => !(typeof r.rating === 'number' && r.rating < 3.5 && !r.trusted));
    list.sort((a: any, b: any) => (a.priceRupees ?? Infinity) - (b.priceRupees ?? Infinity));

    const priced = list.filter((r: any) => typeof r.priceRupees === 'number');
    const cheapestAsin = priced.length ? priced[0].asin : null;
    const trustedPriced = priced.filter((r: any) => r.trusted);
    const bestTrustedAsin = trustedPriced.length ? trustedPriced[0].asin : null;
    const good = priced.filter((r: any) => typeof r.rating === 'number' && r.rating >= 4 && (r.trusted || (r.reviewCount ?? 0) >= 50));
    const bestPickAsin = good.length ? good[0].asin : null;

    const results = list.map((r: any) => {
      const n = packCount(r.extractedUnit);
      return {
        asin: r.asin,
        title: r.title,
        imageUrl: r.imageUrl,
        priceRupees: r.priceRupees,
        pricePerPiece: n && typeof r.priceRupees === 'number' ? Math.round((r.priceRupees / n) * 10) / 10 : null,
        packCount: n,
        seller: r.seller ?? null,
        trusted: !!r.trusted,
        rating: r.rating ?? null,
        reviewCount: r.reviewCount ?? null,
        url: buildAffiliateUrl(r.asin),
      };
    });
    const payload = { results, cheapestAsin, bestTrustedAsin, bestPickAsin, searchedFor };
    if (results.length) await writeFindCache(norm, payload);
    res.json({ ...payload, fallbackUrl, message: results.length ? undefined : 'No products found. Try other words.' });
  } catch (err) {
    console.error('[materials] POST /amazon-find error:', err);
    res.status(500).json({ error: 'Amazon search is not available right now.', fallbackUrl });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const all = await prisma.material.findMany({
      where: { isActive: true },
      select: { category: true, categories: true, icon: true },
    });
    // Union every category a material lists (not just its primary), so
    // the chip row reflects true multi-category membership.
    const seen = new Map<string, string>(); // name -> icon
    for (const m of all) {
      const cats = (m.categories && m.categories.length > 0) ? m.categories : [m.category];
      for (const c of cats) if (!seen.has(c)) seen.set(c, m.icon || '📦');
    }
    const categories = Array.from(seen.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, emoji]) => ({ id: name.toLowerCase().replace(/\s+/g, '_'), name, emoji }));
    res.json(categories);
  } catch (err) {
    console.error('[materials] GET /categories error:', err);
    res.status(500).json({ message: 'Failed to fetch material categories.' });
  }
});

// GET /category-groups — the "clubbed" umbrella groupings for search/browse
// (Sept 2026), e.g. a single "Electronics & Circuits" group surfacing every
// material across several more specific categories at once. Admin
// management UI for this is a Phase 2 follow-up; for now these come from
// seed_material_expansion.ts and are safe to leave exactly as seeded.
router.get('/category-groups', async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.categoryGroup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(groups.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji || '🗂️',
      memberCategories: g.memberCategories,
    })));
  } catch (err) {
    console.error('[materials] GET /category-groups error:', err);
    res.status(500).json({ message: 'Failed to fetch category groups.' });
  }
});

// ── COLLECTIONS (public) — Sept 2026 ─────────────────────────────────────
// "🚁 Drone Building Kit" style curated bundles for the Shop's quick-order
// flow. Public, read-only here — admin management is further down.

// GET /collections — light list for the Shop's chip row (name/icon/count).
// Collections are ordered by sortOrder (lower first); any without one go
// after, alphabetically. Sorted in JS so older records with no sortOrder
// field can never break the query.
function sortCollections<T>(list: T[]): T[] {
  return [...list].sort((a: any, b: any) => {
    const ao = typeof a.sortOrder === 'number' ? a.sortOrder : 999999;
    const bo = typeof b.sortOrder === 'number' ? b.sortOrder : 999999;
    if (ao !== bo) return ao - bo;
    return String(a.name).localeCompare(String(b.name));
  });
}

// { "<materialId>": qty } with whole numbers 1..999 only; anything else is
// dropped. Returns null when nothing valid is left.
function normalizeQuantities(v: any): Record<string, number> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const k of Object.keys(v)) {
    const n = Math.floor(Number(v[k]));
    if (/^[a-f0-9]{24}$/i.test(k) && Number.isFinite(n) && n >= 1 && n <= 999) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// "new-lab" / "home-corner" style page keys. Empty or invalid -> null.
function normalizeLinkKey(v: any): string | null {
  if (typeof v !== 'string') return null;
  const k = v.trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(k) ? k : null;
}

router.get('/collections', async (_req: Request, res: Response) => {
  try {
    const collections = await prisma.materialCollection.findMany({
      where: { isActive: true },
    });
    res.json(
      sortCollections(collections as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        icon: c.icon || '🧰',
        itemCount: c.materialIds.length,
        linkKey: (c as any).linkKey || null,
      }))
    );
  } catch (err) {
    console.error('[materials] GET /collections error:', err);
    res.status(500).json({ message: 'Failed to fetch collections.' });
  }
});

// GET /collections/:id — full collection with resolved, shop-shaped
// materials, for the "tap a collection, see everything pre-checked" sheet.
router.get('/collections/:id', async (req: Request, res: Response) => {
  try {
    const collection = await prisma.materialCollection.findUnique({
      where: { id: req.params.id },
    });
    if (!collection || !collection.isActive) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    const materials = await prisma.material.findMany({
      where: { id: { in: collection.materialIds }, isActive: true },
    });
    // Preserve the admin's chosen ordering rather than whatever order
    // MongoDB happens to return them in.
    const ordered = collection.materialIds
      .map((id) => materials.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
    res.json({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      icon: collection.icon || '🧰',
      materials: ordered.map((m) => ({
        ...toFlutterShape(m),
        defaultQty: ((collection as any).quantities && (collection as any).quantities[m.id]) || 1,
      })),
    });
  } catch (err) {
    console.error('[materials] GET /collections/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch collection.' });
  }
});

// ── ADMIN ROUTES — must come before /:id ─────────────────────────────────────

// GET /admin/collections — full list (including inactive) for the admin tab.
router.get('/admin/collections', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const collections = await prisma.materialCollection.findMany();
    res.json(sortCollections(collections as any[]));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch collections.' });
  }
});

router.post('/admin/collections', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, icon, materialIds } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'name is required.' });
    }
    const newKey = normalizeLinkKey((req.body || {}).linkKey);
    if (newKey) {
      // Only one collection can own a page link at a time.
      await prisma.materialCollection.updateMany({ where: { linkKey: newKey } as any, data: { linkKey: null } as any });
    }
    const collection = await prisma.materialCollection.create({
      data: {
        ...((newKey ? { linkKey: newKey } : {}) as any),
        ...((typeof (req.body || {}).sortOrder === 'number' ? { sortOrder: (req.body || {}).sortOrder } : {}) as any),
        name: name.trim(),
        description: description || undefined,
        icon: icon || '🧰',
        materialIds: Array.isArray(materialIds) ? materialIds : [],
        ...((normalizeQuantities((req.body || {}).quantities) ? { quantities: normalizeQuantities((req.body || {}).quantities) } : {}) as any),
      },
    });
    res.status(201).json(collection);
  } catch (err) {
    console.error('[materials] POST /admin/collections error:', err);
    res.status(500).json({ message: 'Failed to create collection.' });
  }
});

// PUT /admin/collections-order  { ids: [...] } — saves the display order.
router.put('/admin/collections-order', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body && Array.isArray(req.body.ids)
      ? req.body.ids.filter((x: any) => typeof x === 'string')
      : [];
    if (ids.length === 0) {
      return res.status(400).json({ message: 'ids is required.' });
    }
    for (let i = 0; i < ids.length; i++) {
      await prisma.materialCollection.update({ where: { id: ids[i] }, data: { sortOrder: i * 10 } as any });
    }
    res.json({ message: 'Order saved.' });
  } catch (err) {
    console.error('[materials] PUT /admin/collections-order error:', err);
    res.status(500).json({ message: 'Failed to save order.' });
  }
});

router.put('/admin/collections/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, icon, materialIds, isActive } = req.body || {};
    const data: any = {};
    if ('name' in req.body) data.name = name;
    if ('description' in req.body) data.description = description;
    if ('icon' in req.body) data.icon = icon;
    if ('materialIds' in req.body) data.materialIds = Array.isArray(materialIds) ? materialIds : [];
    if ('quantities' in req.body) data.quantities = normalizeQuantities(req.body.quantities) || {};
    if ('isActive' in req.body) data.isActive = Boolean(isActive);
    if ('sortOrder' in req.body) data.sortOrder = typeof req.body.sortOrder === 'number' ? req.body.sortOrder : null;
    if ('linkKey' in req.body) {
      const k = normalizeLinkKey(req.body.linkKey);
      data.linkKey = k;
      if (k) {
        // Only one collection can own a page link at a time.
        await prisma.materialCollection.updateMany({ where: { linkKey: k, id: { not: req.params.id } } as any, data: { linkKey: null } as any });
      }
    }
    const collection = await prisma.materialCollection.update({
      where: { id: req.params.id },
      data,
    });
    res.json(collection);
  } catch (err) {
    console.error('[materials] PUT /admin/collections/:id error:', err);
    res.status(500).json({ message: 'Failed to update collection.' });
  }
});

router.delete('/admin/collections/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.materialCollection.delete({ where: { id: req.params.id } });
    res.json({ message: 'Collection deleted.' });
  } catch (err) {
    console.error('[materials] DELETE /admin/collections/:id error:', err);
    res.status(500).json({ message: 'Failed to delete collection.' });
  }
});

// ── Category groups — admin management (Sept 2026 shop renovation) ────────
// The "clubbed" umbrella groupings used for search/browse. Public read is
// GET /category-groups above; these are the admin write side.
router.get('/admin/category-groups', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.categoryGroup.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(groups);
  } catch (err) {
    console.error('[materials] GET /admin/category-groups error:', err);
    res.status(500).json({ error: 'Failed to fetch category groups.' });
  }
});

router.post('/admin/category-groups', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, emoji, memberCategories, sortOrder } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    const created = await prisma.categoryGroup.create({
      data: {
        name: String(name).trim(),
        emoji: emoji ? String(emoji).trim() : '🗂️',
        memberCategories: Array.isArray(memberCategories)
          ? memberCategories.map((c: any) => String(c).trim()).filter(Boolean) : [],
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 99,
      },
    });
    res.status(201).json(created);
  } catch (err: any) {
    console.error('[materials] POST /admin/category-groups error:', err);
    res.status(500).json({ error: err?.code === 'P2002' ? 'A group with that name already exists.' : 'Failed to create group.' });
  }
});

router.put('/admin/category-groups/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const data: any = {};
    if ('name' in body) data.name = String(body.name).trim();
    if ('emoji' in body) data.emoji = body.emoji ? String(body.emoji).trim() : '🗂️';
    if ('memberCategories' in body) {
      data.memberCategories = Array.isArray(body.memberCategories)
        ? body.memberCategories.map((c: any) => String(c).trim()).filter(Boolean) : [];
    }
    if ('sortOrder' in body && Number.isFinite(Number(body.sortOrder))) data.sortOrder = Number(body.sortOrder);
    if ('isActive' in body) data.isActive = Boolean(body.isActive);
    const updated = await prisma.categoryGroup.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err: any) {
    console.error('[materials] PUT /admin/category-groups/:id error:', err);
    res.status(500).json({ error: err?.code === 'P2002' ? 'A group with that name already exists.' : 'Failed to update group.' });
  }
});

router.delete('/admin/category-groups/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.categoryGroup.delete({ where: { id: req.params.id } });
    res.json({ message: 'Group deleted.' });
  } catch (err) {
    console.error('[materials] DELETE /admin/category-groups/:id error:', err);
    res.status(500).json({ error: 'Failed to delete group.' });
  }
});

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
            priceEstimate, amazonASIN, showInShop, showInPlanning,
            categories, images, aliases, variantOf } = req.body;
    if (!name || !category || goinsPrice === undefined) {
      return res.status(400).json({ error: 'name, category, and goinsPrice are required' });
    }
    const asin = amazonASIN ? String(amazonASIN).trim() : null;
    const data: any = {
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      icon: icon ? String(icon).trim() : null,
      category: String(category).trim(),
      unit: unit ? String(unit).trim() : 'piece',
      goinsPrice: Number(goinsPrice),
      priceEstimate: priceEstimate ? Number(priceEstimate) : null,
      amazonASIN: asin,
      amazonUrl: asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru04-21') : null,
      showInShop: showInShop !== undefined ? Boolean(showInShop) : true,
      showInPlanning: showInPlanning !== undefined ? Boolean(showInPlanning) : true,
      categories: Array.isArray(categories) ? categories.map((c: any) => String(c).trim()).filter(Boolean) : [String(category).trim()],
      images: Array.isArray(images) ? images.map((i: any) => String(i).trim()).filter(Boolean) : (imageUrl ? [String(imageUrl).trim()] : []),
      aliases: Array.isArray(aliases) ? aliases.map((a: any) => String(a).trim().toLowerCase()).filter(Boolean) : [],
      variantOf: variantOf ? String(variantOf).trim() : null,
    };
    syncLegacyFields(data);
    const material = await prisma.material.create({ data });
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

    // Fetch the existing image URL BEFORE overwriting it, so a genuine
    // change can clean up the old Firebase Storage file. This route has
    // always accepted a raw imageUrl string (it's how the "Amazon Setup"
    // ASIN-link flow and any manual paste both save an image), but never
    // deleted what it replaced — silently leaking storage every time an
    // image changed through this path (the dedicated POST /admin/:id/image
    // upload endpoint below has always done this correctly; this one
    // didn't). deleteMaterialImage() is safe to call unconditionally: it
    // no-ops on a URL that isn't one of ours (e.g. an Amazon image, or a
    // manually pasted external link) and on an already-deleted file.
    let previousImageUrl: string | null = null;
    let previousImages: string[] = [];
    if ('imageUrl' in body || 'images' in body) {
      const existing = await prisma.material.findUnique({ where: { id }, select: { imageUrl: true, images: true } });
      previousImageUrl = existing?.imageUrl ?? null;
      previousImages = (existing?.images || []) as string[];
    }

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
      data.amazonUrl  = asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru04-21') : null;
    }
    // Multi-category / multi-image / aliases (Sept 2026 shop upgrade) —
    // additive fields, only touched when the caller actually sends them.
    if ('categories' in body) {
      data.categories = Array.isArray(body.categories) ? body.categories.map((c: any) => String(c).trim()).filter(Boolean) : [];
    }
    if ('images' in body) {
      data.images = Array.isArray(body.images) ? body.images.map((i: any) => String(i).trim()).filter(Boolean) : [];
    }
    if ('aliases' in body) {
      data.aliases = Array.isArray(body.aliases) ? body.aliases.map((a: any) => String(a).trim().toLowerCase()).filter(Boolean) : [];
    }
    // Variants: link this item under a main item (or clear the link). A variant
    // must point at a MAIN item (one that is not itself a variant), and an item
    // that already has variants cannot become a variant.
    if ('variantOf' in body) {
      const target = body.variantOf ? String(body.variantOf).trim() : '';
      if (!target) {
        data.variantOf = null;
      } else {
        if (target === id) return res.status(400).json({ error: 'An item cannot be a variant of itself.' });
        const head = await prisma.material.findUnique({ where: { id: target }, select: { id: true, variantOf: true } });
        if (!head) return res.status(400).json({ error: 'That main item was not found.' });
        if (head.variantOf) return res.status(400).json({ error: 'Pick the main item, not another variant.' });
        const kids = await prisma.material.count({ where: { variantOf: id } });
        if (kids > 0) return res.status(400).json({ error: 'This item already has variants, so it cannot be a variant itself.' });
        data.variantOf = target;
      }
    }
    // Keep the legacy singular fields in sync with any array change made
    // above — done AFTER the individual `if (x in body)` checks so it can
    // see and override whatever they set, and BEFORE the save.
    syncLegacyFields(data);
    // A plain imageUrl change (no images[] sent — the older admin form, the
    // Amazon "Find" flow) on a material that already has an extra-photo
    // list: swap the old primary for the new one inside that list instead
    // of letting the replaced photo silently turn into an "extra".
    if ('imageUrl' in body && !('images' in body) && previousImages.length > 0) {
      const newPrimary: string | null = data.imageUrl ? String(data.imageUrl) : null;
      const rest = previousImages.filter((i) => i && i !== previousImageUrl && i !== newPrimary);
      data.images = newPrimary ? [newPrimary, ...rest] : rest;
    }
    // A manual admin save of ASIN or price is a fresh, human-confirmed
    // answer — clear any stale "needs attention" flag from a prior
    // automated refresh so the exclamation mark doesn't linger forever.
    if ('amazonASIN' in body || 'priceEstimate' in body) {
      data.amazonNeedsAttention = false;
      data.amazonAttentionReason = null;
      data.amazonLastCheckedAt = new Date();
    }

    // ── Automatic Goins (Oct 2026) ──────────────────────────────────────────
    // A Goins value an admin types always wins and locks the item. If the
    // admin leaves Goins alone while changing the price / unit / ASIN and the
    // item is not locked, the agreed formula recalculates it.
    if ('goinsPrice' in body || 'goinsLocked' in body || 'priceEstimate' in body || 'unit' in body || 'amazonASIN' in body || 'description' in body) {
      const prev: any = await prisma.material.findUnique({
        where: { id },
        select: { goinsPrice: true, priceEstimate: true, unit: true, description: true, goinsLocked: true } as any,
      });
      if (prev) {
        const changedByAdmin = 'goinsPrice' in body && Number(body.goinsPrice) !== prev.goinsPrice;
        let locked = prev.goinsLocked === true;
        if ('goinsLocked' in body) locked = body.goinsLocked === true;
        else if (changedByAdmin) locked = true;
        data.goinsLocked = locked;
        if (!locked) {
          const nextPrice = 'priceEstimate' in body ? data.priceEstimate : prev.priceEstimate;
          const nextUnit = 'unit' in body ? data.unit : prev.unit;
          const auto = autoGoinsFor(nextPrice, nextUnit);
          if (auto !== null) data.goinsPrice = auto;
        }
        if ('description' in body && (body.description || null) !== (prev.description || null)) {
          data.descriptionAuto = false; // a person wrote it — never auto-overwrite
        }
      }
    }

    console.log('[PUT /admin/:id] data to save:', data);

    const updated = await prisma.material.update({ where: { id }, data });
    console.log('[PUT /admin/:id] saved amazonASIN:', updated.amazonASIN);

    // Clean up the OLD image only after the new value is safely saved —
    // and only if it's actually different (an admin re-saving the same
    // URL, or clearing it to the same null it already was, isn't a real
    // change and shouldn't touch storage).
    if (('imageUrl' in body || 'images' in body) && previousImageUrl && previousImageUrl !== updated.imageUrl
        && !(updated.images || []).includes(previousImageUrl)) {
      deleteMaterialImage(previousImageUrl).catch((err) =>
        console.warn('[PUT /admin/:id] could not delete old image (non-fatal):', err?.message)
      );
    }
    // Multi-photo: any extra photo the admin just REMOVED from the list is
    // no longer referenced by anything, so clean it up from storage too
    // (same safe helper — no-ops on external/non-bucket URLs).
    if ('images' in body) {
      const keep = new Set<string>([...(updated.images || []), updated.imageUrl || '']);
      for (const oldUrl of previousImages) {
        if (oldUrl && !keep.has(oldUrl) && oldUrl !== previousImageUrl) {
          deleteMaterialImage(oldUrl).catch((err) =>
            console.warn('[PUT /admin/:id] could not delete removed photo (non-fatal):', err?.message)
          );
        }
      }
    }

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

      // ?mode=append (Sept 2026, multi-photo): ADD this upload as an extra
      // photo instead of replacing the primary one. The default (no mode)
      // is unchanged — replaces the primary photo, exactly as before, so
      // any older admin build calling this endpoint keeps working.
      if (req.query.mode === 'append') {
        const newUrl = await uploadMaterialImage(req.file.buffer, req.file.mimetype, id);
        const current: string[] = [
          ...(existing.imageUrl ? [existing.imageUrl] : []),
          ...((existing.images || []) as string[]).filter((i) => i && i !== existing.imageUrl),
        ];
        const nextImages = [...current, newUrl];
        const updatedAppend = await prisma.material.update({
          where: { id },
          data: { images: nextImages, imageUrl: nextImages[0] },
        });
        return res.status(200).json({ message: 'Photo added.', imageUrl: newUrl, images: nextImages, material: updatedAppend });
      }

      // Replacing an existing image? Clean up the old file in Storage so we
      // don't silently accumulate orphaned images every time someone updates
      // a photo (each upload gets a fresh timestamped filename).
      if (existing.imageUrl) {
        await deleteMaterialImage(existing.imageUrl).catch((err) =>
          console.warn('[materials] old image cleanup failed (non-fatal):', err.message)
        );
      }

      const imageUrl = await uploadMaterialImage(req.file.buffer, req.file.mimetype, id);
      // Keep the extra-photo list consistent: the new primary goes first,
      // the replaced primary is dropped, any other extras stay.
      const extras = ((existing.images || []) as string[]).filter((i) => i && i !== existing.imageUrl && i !== imageUrl);
      const updated = await prisma.material.update({
        where: { id },
        data: { imageUrl, images: [imageUrl, ...extras] },
      });
      return res.status(200).json({ message: 'Image uploaded.', imageUrl, images: [imageUrl, ...extras], material: updated });
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

      // All photos currently on this material, primary first.
      const all: string[] = [
        ...(existing.imageUrl ? [existing.imageUrl] : []),
        ...((existing.images || []) as string[]).filter((i) => i && i !== existing.imageUrl),
      ];
      if (all.length === 0) return res.status(200).json({ message: 'No image to remove.' });

      // ?url=<photo> (Sept 2026, multi-photo) removes just that one photo;
      // with no url it removes the primary photo, as it always has — and
      // the next photo (if any) is promoted to primary rather than
      // leaving the material photoless while extras still exist.
      const target = typeof req.query.url === 'string' && req.query.url ? String(req.query.url) : all[0];
      if (!all.includes(target)) return res.status(404).json({ error: 'That photo is not on this material.' });

      await deleteMaterialImage(target);
      const remaining = all.filter((i) => i !== target);
      const updated = await prisma.material.update({
        where: { id },
        data: { images: remaining, imageUrl: remaining.length > 0 ? remaining[0] : null },
      });
      return res.status(200).json({ message: 'Image removed.', images: remaining, material: updated });
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
            amazonUrl: asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru04-21') : null,
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

// ── POST /admin/:id/find-on-amazon — search PA API for candidate products ──
// Gemini (best-effort, optional) refines the search phrase first; PA API
// then does the actual product search. Never auto-links anything — always
// returns candidates for an admin to pick from by hand.
const FIND_DISCARD_KEY = 'amazon_find_discards';
type FindDiscard = { asin: string; title: string };

async function readFindDiscards(materialId: string): Promise<FindDiscard[]> {
  try {
    const row = await prisma.siteContent.findUnique({ where: { key: FIND_DISCARD_KEY } });
    const all: any = (row?.value as any) || {};
    return Array.isArray(all[materialId]) ? all[materialId] : [];
  } catch {
    return [];
  }
}

router.post('/admin/:id/find-on-amazon', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const rawQuery: string = (req.body?.query && String(req.body.query).trim()) || material.name;
    // Products the admin already threw away for this material: hidden from the
    // list and their titles are passed to Gemini so the next search avoids them.
    const discarded = await readFindDiscards(req.params.id);
    const discardedAsins = new Set(discarded.map((d) => d.asin));
    let searchQuery = rawQuery;
    try {
      searchQuery = await refineSearchQuery(
        rawQuery,
        material.description || undefined,
        undefined,
        discarded.slice(-8).map((d) => d.title)
      );
    } catch {
      searchQuery = rawQuery;
    }

    const result = await searchAmazonProducts(searchQuery, 10);
    const visible = (result.results || []).filter((r: any) => !discardedAsins.has(r.asin));
    // Cheapest first; items without a price go last.
    visible.sort((a: any, b: any) => {
      const pa = typeof a.priceRupees === 'number' ? a.priceRupees : Infinity;
      const pb = typeof b.priceRupees === 'number' ? b.priceRupees : Infinity;
      return pa - pb;
    });
    const results = visible.map((r: any) => ({
      ...r,
      detailPageUrl: r.detailPageUrl || buildAffiliateUrl(r.asin),
    }));
    res.json({
      ...result,
      results,
      searchedFor: searchQuery,
      rawQuery,
      hiddenCount: (result.results || []).length - visible.length,
    });
  } catch (err) {
    console.error('[materials] POST /admin/:id/find-on-amazon error:', err);
    res.status(500).json({ configured: true, results: [], error: 'Search failed' });
  }
});

// ── POST /admin/:id/find-by-link — compare a pasted Amazon link ─────────────
// Body: { url }. Looks up the pasted product, then searches for the same or
// similar products and returns them cheapest first, with seller and rating,
// so the admin can pick the best price from a trusted seller.
router.post('/admin/:id/find-by-link', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    let raw = String(req.body?.url || '').trim();
    if (!raw) return res.status(400).json({ error: 'Paste an Amazon link or ASIN' });
    let asin = extractAsinFromUrl(raw);
    // Short links (amzn.in / amzn.to) need one hop to reveal the real address.
    if (!asin && /^https?:\/\/(amzn\.in|amzn\.to|a\.co)\//i.test(raw)) {
      try {
        const r = await fetch(raw, { method: 'GET', redirect: 'follow' });
        asin = extractAsinFromUrl(r.url) || null;
      } catch { /* fall through to the error below */ }
    }
    if (!asin) return res.status(400).json({ error: 'Could not find a product code (ASIN) in that link. Paste the full product page link.' });

    const own = await getAmazonItemsWithSeller([asin]);
    if (!own.configured) return res.json({ configured: false, results: [] });
    const pasted: any = own.results[0];
    if (!pasted) return res.json({ configured: true, results: [], error: own.error || 'Amazon did not return that product.' });

    // Look for the same or similar products.
    const discarded = await readFindDiscards(req.params.id);
    const skip = new Set<string>([asin, ...discarded.map((d) => d.asin)]);
    let query = pasted.title;
    try { query = await refineSearchQuery(pasted.title, undefined, undefined, []); } catch { /* keep the title */ }
    const found = await searchAmazonProducts(query, 10);
    let alts: any[] = (found.results || []).filter((r: any) => !skip.has(r.asin));
    alts.sort((a: any, b: any) => (a.priceRupees ?? Infinity) - (b.priceRupees ?? Infinity));
    alts = alts.slice(0, 6);
    // Add seller and rating to the shortlist in one extra lookup.
    if (alts.length) {
      const more = await getAmazonItemsWithSeller(alts.map((a: any) => a.asin));
      const byAsin = new Map<string, any>((more.results || []).map((r: any) => [r.asin, r]));
      alts = alts.map((a: any) => ({ ...a, ...(byAsin.get(a.asin) || {}) }));
    }
    const withUrl = (r: any) => ({ ...r, detailPageUrl: r.detailPageUrl || buildAffiliateUrl(r.asin) });
    const results = [
      { ...withUrl(pasted), isYourPick: true },
      ...alts.map((a: any) => ({
        ...withUrl(a),
        savings:
          typeof pasted.priceRupees === 'number' && typeof a.priceRupees === 'number' && a.priceRupees < pasted.priceRupees
            ? Math.round(pasted.priceRupees - a.priceRupees)
            : 0,
      })),
    ];
    res.json({ configured: true, results, searchedFor: query, rawQuery: pasted.title, hiddenCount: 0 });
  } catch (err) {
    console.error('[materials] POST /admin/:id/find-by-link error:', err);
    res.status(500).json({ configured: true, results: [], error: 'Comparison failed' });
  }
});

// ── POST /admin/:id/find-discard — remember a clearly wrong match ──────────
// Body: { asin, title }. Stored per material in site_content so the same
// product is not shown again and Gemini avoids similar titles next time.
router.post('/admin/:id/find-discard', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { asin, title } = req.body || {};
    if (!asin || typeof asin !== 'string') return res.status(400).json({ error: 'asin is required' });
    const row = await prisma.siteContent.findUnique({ where: { key: FIND_DISCARD_KEY } });
    const all: any = { ...((row?.value as any) || {}) };
    const list: FindDiscard[] = Array.isArray(all[req.params.id]) ? all[req.params.id] : [];
    if (!list.some((d) => d.asin === asin)) list.push({ asin, title: String(title || '').slice(0, 160) });
    all[req.params.id] = list.slice(-30);
    await prisma.siteContent.upsert({
      where: { key: FIND_DISCARD_KEY },
      update: { value: all },
      create: { key: FIND_DISCARD_KEY, value: all },
    });
    res.json({ ok: true, discarded: all[req.params.id].length });
  } catch (err) {
    console.error('[materials] POST /admin/:id/find-discard error:', err);
    res.status(500).json({ error: 'Could not save the discard' });
  }
});

// ── POST /admin/:id/link-amazon — save a chosen candidate onto a Material ──
// Body: { asin, priceRupees?, imageUrl?, extractedUnit? }. Never overwrites
// an existing Firebase imageUrl (Rule 30) — Amazon's image is only used as
// a fallback when the material has no photo of its own yet. extractedUnit
// (a best-effort quantity guess parsed from the Amazon title, e.g. "Pack
// of 5") is only applied when the material's unit is still the untouched
// default "piece" — never overwrites something an admin deliberately set.
router.post('/admin/:id/link-amazon', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { asin, priceRupees, imageUrl, extractedUnit, tag, description } = req.body || {};
    if (!asin || typeof asin !== 'string') {
      return res.status(400).json({ error: 'asin is required' });
    }
    const existing = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Material not found' });

    const cleanAsin = asin.trim();
    const data: any = {
      amazonASIN: cleanAsin,
      amazonUrl: buildAffiliateUrl(cleanAsin, tag),
    };
    if (priceRupees !== undefined && priceRupees !== null) {
      data.priceEstimate = Math.round(Number(priceRupees));
    }
    // Only fill in an image if this material genuinely has none yet.
    if (!existing.imageUrl && imageUrl) {
      data.imageUrl = String(imageUrl);
    }
    if (extractedUnit && (!existing.unit || existing.unit === 'piece')) {
      data.unit = String(extractedUnit);
    }
    // Description is different from image/unit: linking an ASIN via Find is
    // always a DELIBERATE admin action (they searched, saw a title, and
    // picked it) — so unlike the image/unit fallbacks above, the found
    // product's title always overwrites the description, since the whole
    // point of a correction is matching what's actually being linked.
    if (description && String(description).trim()) {
      data.description = String(description).trim();
    }
    if (data.description) data.descriptionAuto = true; // filled from the Amazon title
    // Automatic Goins from the (new) price and pack size, unless locked.
    if ((existing as any).goinsLocked !== true) {
      const auto = autoGoinsFor(
        data.priceEstimate !== undefined ? data.priceEstimate : existing.priceEstimate,
        data.unit !== undefined ? data.unit : existing.unit
      );
      if (auto !== null) data.goinsPrice = auto;
    }
    // Same as the manual PUT path — a fresh link clears any stale flag.
    data.amazonNeedsAttention = false;
    data.amazonAttentionReason = null;
    data.amazonLastCheckedAt = new Date();

    const updated = await prisma.material.update({ where: { id: req.params.id }, data });
    res.json(toFlutterShape(updated));
  } catch (err) {
    console.error('[materials] POST /admin/:id/link-amazon error:', err);
    res.status(500).json({ error: 'Failed to link Amazon product' });
  }
});

// ── POST /admin/amazon-suggestions/:id/exclude-from-shop ───────────────────
// "This material should stay planning-only, don't try to sell it via
// Amazon at all" — sets the underlying Material's showInShop to false AND
// dismisses the suggestion (so it stops appearing in Pending/No-Match
// lists and, since the scan itself is shop-only now, never gets rescanned
// either). One action instead of two separate manual steps.
router.post('/admin/amazon-suggestions/:id/exclude-from-shop', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const suggestion = await prisma.amazonSuggestion.findUnique({ where: { id: req.params.id } });
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

    await prisma.material.update({
      where: { id: suggestion.materialId },
      data: { showInShop: false, amazonNeedsAttention: false, amazonAttentionReason: null },
    });
    const updated = await rejectAmazonSuggestion(req.params.id, req.user.userId);
    res.json({ message: 'Excluded from shop — stays available for planning only.', suggestion: updated });
  } catch (err) {
    console.error('[materials] POST /admin/amazon-suggestions/:id/exclude-from-shop error:', err);
    res.status(500).json({ error: 'Failed to exclude from shop' });
  }
});

// ── AI Suggestions queue — bulk scan, list, approve, reject ────────────────

// Trigger a bulk scan of materials with no ASIN yet. Runs synchronously
// within the request (bounded by an internal time budget well under Cloud
// Run's timeout) — call again with the same or a higher limit to continue
// where it left off, since already-suggested materials are skipped.
router.post('/admin/amazon-suggestions/scan', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.body?.limit, 10) || 25, 1), 100);
    const summary = await runAmazonSuggestionScan(limit);
    res.json(summary);
  } catch (err) {
    console.error('[materials] POST /admin/amazon-suggestions/scan error:', err);
    res.status(500).json({ error: 'Scan failed' });
  }
});

router.get('/admin/amazon-suggestions', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING';
    const suggestions = await prisma.amazonSuggestion.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(suggestions);
  } catch (err) {
    console.error('[materials] GET /admin/amazon-suggestions error:', err);
    res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

router.post('/admin/amazon-suggestions/:id/approve', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const forceImage = !!req.body?.forceImage;
    const updated = await approveAmazonSuggestion(req.params.id, req.user.userId, forceImage);
    res.json(toFlutterShape(updated));
  } catch (err: any) {
    console.error('[materials] POST /admin/amazon-suggestions/:id/approve error:', err);
    res.status(400).json({ error: err?.message || 'Failed to approve suggestion' });
  }
});

router.post('/admin/amazon-suggestions/:id/reject', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    await rejectAmazonSuggestion(req.params.id, req.user.userId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[materials] POST /admin/amazon-suggestions/:id/reject error:', err);
    res.status(400).json({ error: err?.message || 'Failed to reject suggestion' });
  }
});

// ── Nightly refresh — re-checks already-linked ASINs for price/availability
// drift, flags Material.amazonNeedsAttention. Never writes price/image
// itself. Two ways to call this: manually from admin, or via Cloud
// Scheduler with a shared secret (see MINIGURU_RULES.md deploy notes).
router.post('/admin/amazon-refresh/run', async (req: any, res: any) => {
  const schedulerSecret = req.headers['x-refresh-secret'];
  const isScheduler = !!process.env.AMAZON_REFRESH_SECRET && schedulerSecret === process.env.AMAZON_REFRESH_SECRET;
  if (!isScheduler) {
    // Not the scheduler — fall back to requiring a real admin login.
    return authenticateToken(req, res, () =>
      requireAdmin(req, res, async () => {
        try {
          const summary = await runAmazonRefreshCheck(Math.min(Math.max(parseInt(req.body?.limit, 10) || 100, 1), 500));
          res.json(summary);
        } catch (err) {
          console.error('[materials] POST /admin/amazon-refresh/run error:', err);
          res.status(500).json({ error: 'Refresh failed' });
        }
      })
    );
  }
  try {
    const summary = await runAmazonRefreshCheck(300);
    res.json(summary);
  } catch (err) {
    console.error('[materials] POST /admin/amazon-refresh/run (scheduler) error:', err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

router.get('/admin/amazon-needs-attention', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const materials = await prisma.material.findMany({
      where: { amazonNeedsAttention: true, isActive: true },
      orderBy: { amazonLastCheckedAt: 'desc' },
    });
    res.json(materials.map(toFlutterShape));
  } catch (err) {
    console.error('[materials] GET /admin/amazon-needs-attention error:', err);
    res.status(500).json({ error: 'Failed to load needs-attention list' });
  }
});

// ── POST /admin/amazon-photo-audit — on-demand side-by-side photo check ──
// Never changes anything itself; just returns pairs where the app's stored
// photo differs from Amazon's current one, for a human to look at and
// decide whether to download and replace.
router.post('/admin/amazon-photo-audit', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.body?.limit, 10) || 200, 1), 500);
    const result = await runPhotoAudit(limit);
    res.json(result);
  } catch (err) {
    console.error('[materials] POST /admin/amazon-photo-audit error:', err);
    res.status(500).json({ error: 'Photo audit failed' });
  }
});

// ── Combined daily maintenance (Oct 2026) ────────────────────────────────
// Same two ways in as the older refresh route: Cloud Scheduler with the shared
// secret header, or a logged-in admin (the "Scan & Refresh now" button).
router.post('/admin/materials-daily/run', async (req: any, res: any) => {
  const schedulerSecret = req.headers['x-refresh-secret'];
  const isScheduler = !!process.env.AMAZON_REFRESH_SECRET && schedulerSecret === process.env.AMAZON_REFRESH_SECRET;
  const exec = async () => {
    try {
      const summary = await runMaterialsMaintenance(isScheduler ? {} : { refreshLimit: 100, scanLimit: 10 });
      res.json(summary);
    } catch (err) {
      console.error('[materials] POST /admin/materials-daily/run error:', err);
      res.status(500).json({ error: 'Maintenance run failed' });
    }
  };
  if (isScheduler) return exec();
  return authenticateToken(req, res, () => requireAdmin(req, res, exec));
});

// What the admin page shows as proof the automatic run is working.
router.get('/admin/materials-daily/status', authenticateToken, requireAdmin, async (_req: any, res: any) => {
  try {
    const row = await prisma.siteContent.findUnique({ where: { key: MAINTENANCE_KEY } });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [linked, checked24h, photoMismatches] = await Promise.all([
      prisma.material.count({ where: { amazonASIN: { not: null }, isActive: true } }),
      prisma.material.count({ where: { amazonASIN: { not: null }, isActive: true, amazonLastCheckedAt: { gte: since } } }),
      prisma.material.count({ where: { photoMismatch: true, isActive: true } as any }),
    ]);
    res.json({
      lastRun: row?.value ?? null,
      lastRunSavedAt: row?.updatedAt ?? null,
      schedulerSecretSet: !!process.env.AMAZON_REFRESH_SECRET,
      linked, checked24h, photoMismatches,
    });
  } catch (err) {
    console.error('[materials] GET /admin/materials-daily/status error:', err);
    res.status(500).json({ error: 'Failed to load status' });
  }
});

// Materials whose stored Amazon photo differs from Amazon's current one.
router.get('/admin/photo-mismatches', authenticateToken, requireAdmin, async (_req: any, res: any) => {
  try {
    const rows: any[] = await prisma.material.findMany({
      where: { photoMismatch: true, isActive: true } as any,
      orderBy: { name: 'asc' },
      take: 500,
    });
    res.json(rows.map((m) => ({
      materialId: m.id,
      materialName: m.name,
      appImageUrl: m.imageUrl,
      amazonImageUrl: m.photoMismatchAmazonUrl,
    })));
  } catch (err) {
    console.error('[materials] GET /admin/photo-mismatches error:', err);
    res.status(500).json({ error: 'Failed to load photo mismatches' });
  }
});

// action 'keep' = keep my photo (remember Amazon's current picture so it is not flagged again);
// anything else = just clear the flag (used after "Use Amazon photo" or "Exclude").
router.post('/admin/photo-mismatches/:id/resolve', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const m: any = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!m) return res.status(404).json({ error: 'Material not found' });
    const data: any = { photoMismatch: false, photoMismatchAmazonUrl: null };
    if (req.body?.action === 'keep') data.photoIgnoredKey = amazonImageKey(m.photoMismatchAmazonUrl);
    await prisma.material.update({ where: { id: req.params.id }, data });
    res.json({ success: true });
  } catch (err) {
    console.error('[materials] POST /admin/photo-mismatches/:id/resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve' });
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