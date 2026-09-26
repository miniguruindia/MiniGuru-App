"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const firebaseStorageService_1 = require("../services/firebaseStorageService");
const amazonProductService_1 = require("../services/amazonProductService");
const materialSearchAssistService_1 = require("../services/materialSearchAssistService");
const amazonSuggestionService_1 = require("../services/amazonSuggestionService");
const router = (0, express_1.Router)();
// Memory storage (not disk) — we hand the buffer straight to Firebase
// Storage, never touching Cloud Run's ephemeral local disk for this.
const imageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — plenty for a material photo
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed.'));
        }
        cb(null, true);
    },
});
function requireAdmin(req, res, next) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
function toFlutterShape(m) {
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
        amazonNeedsAttention: m.amazonNeedsAttention || false,
        amazonAttentionReason: m.amazonAttentionReason || null,
        amazonLastCheckedAt: m.amazonLastCheckedAt,
        createdAt: m.createdAt,
    };
}
// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { category, categoryId } = req.query;
        const where = { isActive: true };
        if (category) {
            where.category = String(category);
        }
        else if (categoryId) {
            const slug = String(categoryId).replace(/_/g, ' ');
            where.category = { equals: slug, mode: 'insensitive' };
        }
        const materials = await prismaClient_1.default.material.findMany({
            where,
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
        res.json(materials.map(toFlutterShape));
    }
    catch (err) {
        console.error('[materials] GET / error:', err);
        res.status(500).json({ message: 'Failed to fetch materials.' });
    }
});
router.get('/categories', async (_req, res) => {
    try {
        const results = await prismaClient_1.default.material.findMany({
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
    }
    catch (err) {
        console.error('[materials] GET /categories error:', err);
        res.status(500).json({ message: 'Failed to fetch material categories.' });
    }
});
// ── COLLECTIONS (public) — Sept 2026 ─────────────────────────────────────
// "🚁 Drone Building Kit" style curated bundles for the Shop's quick-order
// flow. Public, read-only here — admin management is further down.
// GET /collections — light list for the Shop's chip row (name/icon/count).
router.get('/collections', async (_req, res) => {
    try {
        const collections = await prismaClient_1.default.materialCollection.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        res.json(collections.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            icon: c.icon || '🧰',
            itemCount: c.materialIds.length,
        })));
    }
    catch (err) {
        console.error('[materials] GET /collections error:', err);
        res.status(500).json({ message: 'Failed to fetch collections.' });
    }
});
// GET /collections/:id — full collection with resolved, shop-shaped
// materials, for the "tap a collection, see everything pre-checked" sheet.
router.get('/collections/:id', async (req, res) => {
    try {
        const collection = await prismaClient_1.default.materialCollection.findUnique({
            where: { id: req.params.id },
        });
        if (!collection || !collection.isActive) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        const materials = await prismaClient_1.default.material.findMany({
            where: { id: { in: collection.materialIds }, isActive: true },
        });
        // Preserve the admin's chosen ordering rather than whatever order
        // MongoDB happens to return them in.
        const ordered = collection.materialIds
            .map((id) => materials.find((m) => m.id === id))
            .filter((m) => Boolean(m));
        res.json({
            id: collection.id,
            name: collection.name,
            description: collection.description,
            icon: collection.icon || '🧰',
            materials: ordered.map(toFlutterShape),
        });
    }
    catch (err) {
        console.error('[materials] GET /collections/:id error:', err);
        res.status(500).json({ message: 'Failed to fetch collection.' });
    }
});
// ── ADMIN ROUTES — must come before /:id ─────────────────────────────────────
// GET /admin/collections — full list (including inactive) for the admin tab.
router.get('/admin/collections', authMiddleware_1.authenticateToken, requireAdmin, async (_req, res) => {
    try {
        const collections = await prismaClient_1.default.materialCollection.findMany({ orderBy: { name: 'asc' } });
        res.json(collections);
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to fetch collections.' });
    }
});
router.post('/admin/collections', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, icon, materialIds } = req.body || {};
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ message: 'name is required.' });
        }
        const collection = await prismaClient_1.default.materialCollection.create({
            data: {
                name: name.trim(),
                description: description || undefined,
                icon: icon || '🧰',
                materialIds: Array.isArray(materialIds) ? materialIds : [],
            },
        });
        res.status(201).json(collection);
    }
    catch (err) {
        console.error('[materials] POST /admin/collections error:', err);
        res.status(500).json({ message: 'Failed to create collection.' });
    }
});
router.put('/admin/collections/:id', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, icon, materialIds, isActive } = req.body || {};
        const data = {};
        if ('name' in req.body)
            data.name = name;
        if ('description' in req.body)
            data.description = description;
        if ('icon' in req.body)
            data.icon = icon;
        if ('materialIds' in req.body)
            data.materialIds = Array.isArray(materialIds) ? materialIds : [];
        if ('isActive' in req.body)
            data.isActive = Boolean(isActive);
        const collection = await prismaClient_1.default.materialCollection.update({
            where: { id: req.params.id },
            data,
        });
        res.json(collection);
    }
    catch (err) {
        console.error('[materials] PUT /admin/collections/:id error:', err);
        res.status(500).json({ message: 'Failed to update collection.' });
    }
});
router.delete('/admin/collections/:id', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        await prismaClient_1.default.materialCollection.delete({ where: { id: req.params.id } });
        res.json({ message: 'Collection deleted.' });
    }
    catch (err) {
        console.error('[materials] DELETE /admin/collections/:id error:', err);
        res.status(500).json({ message: 'Failed to delete collection.' });
    }
});
router.get('/admin/all', authMiddleware_1.authenticateToken, requireAdmin, async (_req, res) => {
    try {
        const materials = await prismaClient_1.default.material.findMany({
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
        res.json(materials);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch materials' });
    }
});
router.post('/admin/create', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, imageUrl, icon, category, unit, goinsPrice, priceEstimate, amazonASIN, showInShop, showInPlanning } = req.body;
        if (!name || !category || goinsPrice === undefined) {
            return res.status(400).json({ error: 'name, category, and goinsPrice are required' });
        }
        const asin = amazonASIN ? String(amazonASIN).trim() : null;
        const material = await prismaClient_1.default.material.create({
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
                amazonUrl: asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru04-21') : null,
                showInShop: showInShop !== undefined ? Boolean(showInShop) : true,
                showInPlanning: showInPlanning !== undefined ? Boolean(showInPlanning) : true,
            },
        });
        res.status(201).json(material);
    }
    catch (err) {
        console.error('[materials] POST /admin/create error:', err);
        res.status(500).json({ error: 'Failed to create material' });
    }
});
router.put('/admin/:id', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
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
        let previousImageUrl = null;
        if ('imageUrl' in body) {
            const existing = await prismaClient_1.default.material.findUnique({ where: { id }, select: { imageUrl: true } });
            previousImageUrl = existing?.imageUrl ?? null;
        }
        // Build update object — only include keys that are present in body
        const data = {};
        if ('name' in body)
            data.name = body.name;
        if ('description' in body)
            data.description = body.description;
        if ('imageUrl' in body)
            data.imageUrl = body.imageUrl;
        if ('icon' in body)
            data.icon = body.icon;
        if ('category' in body)
            data.category = body.category;
        if ('unit' in body)
            data.unit = body.unit;
        if ('goinsPrice' in body)
            data.goinsPrice = Number(body.goinsPrice);
        if ('isActive' in body)
            data.isActive = body.isActive;
        if ('showInShop' in body)
            data.showInShop = body.showInShop;
        if ('showInPlanning' in body)
            data.showInPlanning = body.showInPlanning;
        if ('priceEstimate' in body)
            data.priceEstimate = body.priceEstimate ? Number(body.priceEstimate) : null;
        if ('amazonASIN' in body) {
            const asin = body.amazonASIN ? String(body.amazonASIN).trim() : null;
            data.amazonASIN = asin;
            data.amazonUrl = asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru04-21') : null;
        }
        // A manual admin save of ASIN or price is a fresh, human-confirmed
        // answer — clear any stale "needs attention" flag from a prior
        // automated refresh so the exclamation mark doesn't linger forever.
        if ('amazonASIN' in body || 'priceEstimate' in body) {
            data.amazonNeedsAttention = false;
            data.amazonAttentionReason = null;
            data.amazonLastCheckedAt = new Date();
        }
        console.log('[PUT /admin/:id] data to save:', data);
        const updated = await prismaClient_1.default.material.update({ where: { id }, data });
        console.log('[PUT /admin/:id] saved amazonASIN:', updated.amazonASIN);
        // Clean up the OLD image only after the new value is safely saved —
        // and only if it's actually different (an admin re-saving the same
        // URL, or clearing it to the same null it already was, isn't a real
        // change and shouldn't touch storage).
        if ('imageUrl' in body && previousImageUrl && previousImageUrl !== updated.imageUrl) {
            (0, firebaseStorageService_1.deleteMaterialImage)(previousImageUrl).catch((err) => console.warn('[PUT /admin/:id] could not delete old image (non-fatal):', err?.message));
        }
        return res.json(updated);
    }
    catch (err) {
        console.error('material update error:', err);
        return res.status(500).json({ error: err.message });
    }
});
router.delete('/admin/:id', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        await prismaClient_1.default.material.update({
            where: { id: req.params.id },
            data: { isActive: false },
        });
        res.json({ success: true, message: 'Material deactivated' });
    }
    catch (err) {
        if (err?.code === 'P2025')
            return res.status(404).json({ error: 'Material not found' });
        res.status(500).json({ error: 'Failed to deactivate material' });
    }
});
// ── Direct image upload/replace/delete ───────────────────────────────────────
// Replaces the old manual "download from Drive → resize → drag into
// Firebase Console" workflow. Uploads straight to the same Firebase Storage
// bucket every existing material image already lives in.
router.post('/admin/:id/image', authMiddleware_1.authenticateToken, requireAdmin, imageUpload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file)
            return res.status(400).json({ error: 'No image file provided (field name: image).' });
        const existing = await prismaClient_1.default.material.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ error: 'Material not found' });
        // Replacing an existing image? Clean up the old file in Storage so we
        // don't silently accumulate orphaned images every time someone updates
        // a photo (each upload gets a fresh timestamped filename).
        if (existing.imageUrl) {
            await (0, firebaseStorageService_1.deleteMaterialImage)(existing.imageUrl).catch((err) => console.warn('[materials] old image cleanup failed (non-fatal):', err.message));
        }
        const imageUrl = await (0, firebaseStorageService_1.uploadMaterialImage)(req.file.buffer, req.file.mimetype, id);
        const updated = await prismaClient_1.default.material.update({ where: { id }, data: { imageUrl } });
        return res.status(200).json({ message: 'Image uploaded.', imageUrl, material: updated });
    }
    catch (err) {
        console.error('[materials] image upload error:', err);
        return res.status(500).json({ error: err.message || 'Image upload failed.' });
    }
});
router.delete('/admin/:id/image', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prismaClient_1.default.material.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ error: 'Material not found' });
        if (!existing.imageUrl)
            return res.status(200).json({ message: 'No image to remove.' });
        await (0, firebaseStorageService_1.deleteMaterialImage)(existing.imageUrl);
        const updated = await prismaClient_1.default.material.update({ where: { id }, data: { imageUrl: null } });
        return res.status(200).json({ message: 'Image removed.', material: updated });
    }
    catch (err) {
        console.error('[materials] image delete error:', err);
        return res.status(500).json({ error: err.message || 'Image delete failed.' });
    }
});
router.post('/admin/bulk', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { materials } = req.body;
        if (!Array.isArray(materials) || materials.length === 0) {
            return res.status(400).json({ error: 'Body must be { materials: [...] }' });
        }
        const results = { created: 0, skipped: 0, errors: [] };
        for (let i = 0; i < materials.length; i++) {
            const m = materials[i];
            try {
                if (!m.name || !m.category || m.goinsPrice === undefined) {
                    results.errors.push({ row: i + 1, name: m.name || '(unnamed)', error: 'Missing name, category, or goinsPrice' });
                    results.skipped++;
                    continue;
                }
                const existing = await prismaClient_1.default.material.findFirst({
                    where: { name: String(m.name).trim(), category: String(m.category).trim() },
                });
                if (existing) {
                    results.errors.push({ row: i + 1, name: m.name, error: 'Already exists — skipped' });
                    results.skipped++;
                    continue;
                }
                const asin = m.amazonASIN ? String(m.amazonASIN).trim() : null;
                await prismaClient_1.default.material.create({
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
            }
            catch (rowErr) {
                results.errors.push({ row: i + 1, name: m.name || '(unnamed)', error: rowErr.message });
                results.skipped++;
            }
        }
        res.status(201).json(results);
    }
    catch (err) {
        console.error('[materials] POST /admin/bulk error:', err);
        res.status(500).json({ error: 'Bulk upload failed' });
    }
});
// ── POST /admin/:id/find-on-amazon — search PA API for candidate products ──
// Gemini (best-effort, optional) refines the search phrase first; PA API
// then does the actual product search. Never auto-links anything — always
// returns candidates for an admin to pick from by hand.
router.post('/admin/:id/find-on-amazon', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const material = await prismaClient_1.default.material.findUnique({ where: { id: req.params.id } });
        if (!material)
            return res.status(404).json({ error: 'Material not found' });
        const rawQuery = (req.body?.query && String(req.body.query).trim()) || material.name;
        let searchQuery = rawQuery;
        try {
            searchQuery = await (0, materialSearchAssistService_1.refineSearchQuery)(rawQuery, material.description || undefined);
        }
        catch {
            // refineSearchQuery already never throws, but stay defensive here too
            searchQuery = rawQuery;
        }
        const result = await (0, amazonProductService_1.searchAmazonProducts)(searchQuery, 5);
        res.json({ ...result, searchedFor: searchQuery, rawQuery });
    }
    catch (err) {
        console.error('[materials] POST /admin/:id/find-on-amazon error:', err);
        res.status(500).json({ configured: true, results: [], error: 'Search failed' });
    }
});
// ── POST /admin/:id/link-amazon — save a chosen candidate onto a Material ──
// Body: { asin, priceRupees?, imageUrl?, extractedUnit? }. Never overwrites
// an existing Firebase imageUrl (Rule 30) — Amazon's image is only used as
// a fallback when the material has no photo of its own yet. extractedUnit
// (a best-effort quantity guess parsed from the Amazon title, e.g. "Pack
// of 5") is only applied when the material's unit is still the untouched
// default "piece" — never overwrites something an admin deliberately set.
router.post('/admin/:id/link-amazon', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { asin, priceRupees, imageUrl, extractedUnit, tag, description } = req.body || {};
        if (!asin || typeof asin !== 'string') {
            return res.status(400).json({ error: 'asin is required' });
        }
        const existing = await prismaClient_1.default.material.findUnique({ where: { id: req.params.id } });
        if (!existing)
            return res.status(404).json({ error: 'Material not found' });
        const cleanAsin = asin.trim();
        const data = {
            amazonASIN: cleanAsin,
            amazonUrl: (0, amazonProductService_1.buildAffiliateUrl)(cleanAsin, tag),
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
        // Same as the manual PUT path — a fresh link clears any stale flag.
        data.amazonNeedsAttention = false;
        data.amazonAttentionReason = null;
        data.amazonLastCheckedAt = new Date();
        const updated = await prismaClient_1.default.material.update({ where: { id: req.params.id }, data });
        res.json(toFlutterShape(updated));
    }
    catch (err) {
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
router.post('/admin/amazon-suggestions/:id/exclude-from-shop', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const suggestion = await prismaClient_1.default.amazonSuggestion.findUnique({ where: { id: req.params.id } });
        if (!suggestion)
            return res.status(404).json({ error: 'Suggestion not found' });
        await prismaClient_1.default.material.update({
            where: { id: suggestion.materialId },
            data: { showInShop: false, amazonNeedsAttention: false, amazonAttentionReason: null },
        });
        const updated = await (0, amazonSuggestionService_1.rejectAmazonSuggestion)(req.params.id, req.user.userId);
        res.json({ message: 'Excluded from shop — stays available for planning only.', suggestion: updated });
    }
    catch (err) {
        console.error('[materials] POST /admin/amazon-suggestions/:id/exclude-from-shop error:', err);
        res.status(500).json({ error: 'Failed to exclude from shop' });
    }
});
// ── AI Suggestions queue — bulk scan, list, approve, reject ────────────────
// Trigger a bulk scan of materials with no ASIN yet. Runs synchronously
// within the request (bounded by an internal time budget well under Cloud
// Run's timeout) — call again with the same or a higher limit to continue
// where it left off, since already-suggested materials are skipped.
router.post('/admin/amazon-suggestions/scan', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.body?.limit, 10) || 25, 1), 100);
        const summary = await (0, amazonSuggestionService_1.runAmazonSuggestionScan)(limit);
        res.json(summary);
    }
    catch (err) {
        console.error('[materials] POST /admin/amazon-suggestions/scan error:', err);
        res.status(500).json({ error: 'Scan failed' });
    }
});
router.get('/admin/amazon-suggestions', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING';
        const suggestions = await prismaClient_1.default.amazonSuggestion.findMany({
            where: { status },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        res.json(suggestions);
    }
    catch (err) {
        console.error('[materials] GET /admin/amazon-suggestions error:', err);
        res.status(500).json({ error: 'Failed to load suggestions' });
    }
});
router.post('/admin/amazon-suggestions/:id/approve', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const forceImage = !!req.body?.forceImage;
        const updated = await (0, amazonSuggestionService_1.approveAmazonSuggestion)(req.params.id, req.user.userId, forceImage);
        res.json(toFlutterShape(updated));
    }
    catch (err) {
        console.error('[materials] POST /admin/amazon-suggestions/:id/approve error:', err);
        res.status(400).json({ error: err?.message || 'Failed to approve suggestion' });
    }
});
router.post('/admin/amazon-suggestions/:id/reject', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        await (0, amazonSuggestionService_1.rejectAmazonSuggestion)(req.params.id, req.user.userId);
        res.json({ success: true });
    }
    catch (err) {
        console.error('[materials] POST /admin/amazon-suggestions/:id/reject error:', err);
        res.status(400).json({ error: err?.message || 'Failed to reject suggestion' });
    }
});
// ── Nightly refresh — re-checks already-linked ASINs for price/availability
// drift, flags Material.amazonNeedsAttention. Never writes price/image
// itself. Two ways to call this: manually from admin, or via Cloud
// Scheduler with a shared secret (see MINIGURU_RULES.md deploy notes).
router.post('/admin/amazon-refresh/run', async (req, res) => {
    const schedulerSecret = req.headers['x-refresh-secret'];
    const isScheduler = !!process.env.AMAZON_REFRESH_SECRET && schedulerSecret === process.env.AMAZON_REFRESH_SECRET;
    if (!isScheduler) {
        // Not the scheduler — fall back to requiring a real admin login.
        return (0, authMiddleware_1.authenticateToken)(req, res, () => requireAdmin(req, res, async () => {
            try {
                const summary = await (0, amazonSuggestionService_1.runAmazonRefreshCheck)(Math.min(Math.max(parseInt(req.body?.limit, 10) || 50, 1), 200));
                res.json(summary);
            }
            catch (err) {
                console.error('[materials] POST /admin/amazon-refresh/run error:', err);
                res.status(500).json({ error: 'Refresh failed' });
            }
        }));
    }
    try {
        const summary = await (0, amazonSuggestionService_1.runAmazonRefreshCheck)(100);
        res.json(summary);
    }
    catch (err) {
        console.error('[materials] POST /admin/amazon-refresh/run (scheduler) error:', err);
        res.status(500).json({ error: 'Refresh failed' });
    }
});
router.get('/admin/amazon-needs-attention', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const materials = await prismaClient_1.default.material.findMany({
            where: { amazonNeedsAttention: true, isActive: true },
            orderBy: { amazonLastCheckedAt: 'desc' },
        });
        res.json(materials.map(toFlutterShape));
    }
    catch (err) {
        console.error('[materials] GET /admin/amazon-needs-attention error:', err);
        res.status(500).json({ error: 'Failed to load needs-attention list' });
    }
});
// ── POST /admin/amazon-photo-audit — on-demand side-by-side photo check ──
// Never changes anything itself; just returns pairs where the app's stored
// photo differs from Amazon's current one, for a human to look at and
// decide whether to download and replace.
router.post('/admin/amazon-photo-audit', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.body?.limit, 10) || 100, 1), 300);
        const result = await (0, amazonSuggestionService_1.runPhotoAudit)(limit);
        res.json(result);
    }
    catch (err) {
        console.error('[materials] POST /admin/amazon-photo-audit error:', err);
        res.status(500).json({ error: 'Photo audit failed' });
    }
});
// ── GET /:id — PUBLIC, must be LAST ──────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const material = await prismaClient_1.default.material.findUnique({
            where: { id: req.params.id },
        });
        if (!material || !material.isActive) {
            return res.status(404).json({ message: 'Material not found' });
        }
        res.json(toFlutterShape(material));
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to fetch material' });
    }
});
exports.default = router;
