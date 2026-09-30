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
    const categories = (m.categories && m.categories.length > 0) ? m.categories : [m.category];
    // imageUrl (the legacy single field) is ALWAYS the first/primary photo
    // and is authoritative — older write paths (the single-photo upload,
    // Amazon approval, plain PUT with imageUrl) only ever touch that field,
    // so putting it first here guarantees a stale images[] can never make
    // the wrong photo show as the primary one. Any extra photos follow it.
    const extraImages = (m.images || []).filter((i) => i && i !== m.imageUrl);
    const images = m.imageUrl ? [m.imageUrl, ...extraImages] : extraImages;
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
function syncLegacyFields(data) {
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
router.get('/', async (req, res) => {
    try {
        const { category, categoryId, search } = req.query;
        const where = { isActive: true };
        const clauses = [];
        if (category) {
            // Matches either the legacy primary category OR membership in the
            // full categories[] array — so a material added to more than one
            // category shows up under any of them, not just its first/primary.
            clauses.push({ OR: [{ category: String(category) }, { categories: { has: String(category) } }] });
        }
        else if (categoryId) {
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
        if (clauses.length > 0)
            where.AND = clauses;
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
        const all = await prismaClient_1.default.material.findMany({
            where: { isActive: true },
            select: { category: true, categories: true, icon: true },
        });
        // Union every category a material lists (not just its primary), so
        // the chip row reflects true multi-category membership.
        const seen = new Map(); // name -> icon
        for (const m of all) {
            const cats = (m.categories && m.categories.length > 0) ? m.categories : [m.category];
            for (const c of cats)
                if (!seen.has(c))
                    seen.set(c, m.icon || '📦');
        }
        const categories = Array.from(seen.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, emoji]) => ({ id: name.toLowerCase().replace(/\s+/g, '_'), name, emoji }));
        res.json(categories);
    }
    catch (err) {
        console.error('[materials] GET /categories error:', err);
        res.status(500).json({ message: 'Failed to fetch material categories.' });
    }
});
// GET /category-groups — the "clubbed" umbrella groupings for search/browse
// (Sept 2026), e.g. a single "Electronics & Circuits" group surfacing every
// material across several more specific categories at once. Admin
// management UI for this is a Phase 2 follow-up; for now these come from
// seed_material_expansion.ts and are safe to leave exactly as seeded.
router.get('/category-groups', async (_req, res) => {
    try {
        const groups = await prismaClient_1.default.categoryGroup.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
        });
        res.json(groups.map((g) => ({
            id: g.id,
            name: g.name,
            emoji: g.emoji || '🗂️',
            memberCategories: g.memberCategories,
        })));
    }
    catch (err) {
        console.error('[materials] GET /category-groups error:', err);
        res.status(500).json({ message: 'Failed to fetch category groups.' });
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
// ── Category groups — admin management (Sept 2026 shop renovation) ────────
// The "clubbed" umbrella groupings used for search/browse. Public read is
// GET /category-groups above; these are the admin write side.
router.get('/admin/category-groups', authMiddleware_1.authenticateToken, requireAdmin, async (_req, res) => {
    try {
        const groups = await prismaClient_1.default.categoryGroup.findMany({ orderBy: { sortOrder: 'asc' } });
        res.json(groups);
    }
    catch (err) {
        console.error('[materials] GET /admin/category-groups error:', err);
        res.status(500).json({ error: 'Failed to fetch category groups.' });
    }
});
router.post('/admin/category-groups', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, emoji, memberCategories, sortOrder } = req.body || {};
        if (!name || !String(name).trim())
            return res.status(400).json({ error: 'name is required' });
        const created = await prismaClient_1.default.categoryGroup.create({
            data: {
                name: String(name).trim(),
                emoji: emoji ? String(emoji).trim() : '🗂️',
                memberCategories: Array.isArray(memberCategories)
                    ? memberCategories.map((c) => String(c).trim()).filter(Boolean) : [],
                sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 99,
            },
        });
        res.status(201).json(created);
    }
    catch (err) {
        console.error('[materials] POST /admin/category-groups error:', err);
        res.status(500).json({ error: err?.code === 'P2002' ? 'A group with that name already exists.' : 'Failed to create group.' });
    }
});
router.put('/admin/category-groups/:id', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const body = req.body || {};
        const data = {};
        if ('name' in body)
            data.name = String(body.name).trim();
        if ('emoji' in body)
            data.emoji = body.emoji ? String(body.emoji).trim() : '🗂️';
        if ('memberCategories' in body) {
            data.memberCategories = Array.isArray(body.memberCategories)
                ? body.memberCategories.map((c) => String(c).trim()).filter(Boolean) : [];
        }
        if ('sortOrder' in body && Number.isFinite(Number(body.sortOrder)))
            data.sortOrder = Number(body.sortOrder);
        if ('isActive' in body)
            data.isActive = Boolean(body.isActive);
        const updated = await prismaClient_1.default.categoryGroup.update({ where: { id: req.params.id }, data });
        res.json(updated);
    }
    catch (err) {
        console.error('[materials] PUT /admin/category-groups/:id error:', err);
        res.status(500).json({ error: err?.code === 'P2002' ? 'A group with that name already exists.' : 'Failed to update group.' });
    }
});
router.delete('/admin/category-groups/:id', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        await prismaClient_1.default.categoryGroup.delete({ where: { id: req.params.id } });
        res.json({ message: 'Group deleted.' });
    }
    catch (err) {
        console.error('[materials] DELETE /admin/category-groups/:id error:', err);
        res.status(500).json({ error: 'Failed to delete group.' });
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
        const { name, description, imageUrl, icon, category, unit, goinsPrice, priceEstimate, amazonASIN, showInShop, showInPlanning, categories, images, aliases } = req.body;
        if (!name || !category || goinsPrice === undefined) {
            return res.status(400).json({ error: 'name, category, and goinsPrice are required' });
        }
        const asin = amazonASIN ? String(amazonASIN).trim() : null;
        const data = {
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
            categories: Array.isArray(categories) ? categories.map((c) => String(c).trim()).filter(Boolean) : [String(category).trim()],
            images: Array.isArray(images) ? images.map((i) => String(i).trim()).filter(Boolean) : (imageUrl ? [String(imageUrl).trim()] : []),
            aliases: Array.isArray(aliases) ? aliases.map((a) => String(a).trim().toLowerCase()).filter(Boolean) : [],
        };
        syncLegacyFields(data);
        const material = await prismaClient_1.default.material.create({ data });
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
        let previousImages = [];
        if ('imageUrl' in body || 'images' in body) {
            const existing = await prismaClient_1.default.material.findUnique({ where: { id }, select: { imageUrl: true, images: true } });
            previousImageUrl = existing?.imageUrl ?? null;
            previousImages = (existing?.images || []);
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
        // Multi-category / multi-image / aliases (Sept 2026 shop upgrade) —
        // additive fields, only touched when the caller actually sends them.
        if ('categories' in body) {
            data.categories = Array.isArray(body.categories) ? body.categories.map((c) => String(c).trim()).filter(Boolean) : [];
        }
        if ('images' in body) {
            data.images = Array.isArray(body.images) ? body.images.map((i) => String(i).trim()).filter(Boolean) : [];
        }
        if ('aliases' in body) {
            data.aliases = Array.isArray(body.aliases) ? body.aliases.map((a) => String(a).trim().toLowerCase()).filter(Boolean) : [];
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
            const newPrimary = data.imageUrl ? String(data.imageUrl) : null;
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
        console.log('[PUT /admin/:id] data to save:', data);
        const updated = await prismaClient_1.default.material.update({ where: { id }, data });
        console.log('[PUT /admin/:id] saved amazonASIN:', updated.amazonASIN);
        // Clean up the OLD image only after the new value is safely saved —
        // and only if it's actually different (an admin re-saving the same
        // URL, or clearing it to the same null it already was, isn't a real
        // change and shouldn't touch storage).
        if (('imageUrl' in body || 'images' in body) && previousImageUrl && previousImageUrl !== updated.imageUrl
            && !(updated.images || []).includes(previousImageUrl)) {
            (0, firebaseStorageService_1.deleteMaterialImage)(previousImageUrl).catch((err) => console.warn('[PUT /admin/:id] could not delete old image (non-fatal):', err?.message));
        }
        // Multi-photo: any extra photo the admin just REMOVED from the list is
        // no longer referenced by anything, so clean it up from storage too
        // (same safe helper — no-ops on external/non-bucket URLs).
        if ('images' in body) {
            const keep = new Set([...(updated.images || []), updated.imageUrl || '']);
            for (const oldUrl of previousImages) {
                if (oldUrl && !keep.has(oldUrl) && oldUrl !== previousImageUrl) {
                    (0, firebaseStorageService_1.deleteMaterialImage)(oldUrl).catch((err) => console.warn('[PUT /admin/:id] could not delete removed photo (non-fatal):', err?.message));
                }
            }
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
        // ?mode=append (Sept 2026, multi-photo): ADD this upload as an extra
        // photo instead of replacing the primary one. The default (no mode)
        // is unchanged — replaces the primary photo, exactly as before, so
        // any older admin build calling this endpoint keeps working.
        if (req.query.mode === 'append') {
            const newUrl = await (0, firebaseStorageService_1.uploadMaterialImage)(req.file.buffer, req.file.mimetype, id);
            const current = [
                ...(existing.imageUrl ? [existing.imageUrl] : []),
                ...(existing.images || []).filter((i) => i && i !== existing.imageUrl),
            ];
            const nextImages = [...current, newUrl];
            const updatedAppend = await prismaClient_1.default.material.update({
                where: { id },
                data: { images: nextImages, imageUrl: nextImages[0] },
            });
            return res.status(200).json({ message: 'Photo added.', imageUrl: newUrl, images: nextImages, material: updatedAppend });
        }
        // Replacing an existing image? Clean up the old file in Storage so we
        // don't silently accumulate orphaned images every time someone updates
        // a photo (each upload gets a fresh timestamped filename).
        if (existing.imageUrl) {
            await (0, firebaseStorageService_1.deleteMaterialImage)(existing.imageUrl).catch((err) => console.warn('[materials] old image cleanup failed (non-fatal):', err.message));
        }
        const imageUrl = await (0, firebaseStorageService_1.uploadMaterialImage)(req.file.buffer, req.file.mimetype, id);
        // Keep the extra-photo list consistent: the new primary goes first,
        // the replaced primary is dropped, any other extras stay.
        const extras = (existing.images || []).filter((i) => i && i !== existing.imageUrl && i !== imageUrl);
        const updated = await prismaClient_1.default.material.update({
            where: { id },
            data: { imageUrl, images: [imageUrl, ...extras] },
        });
        return res.status(200).json({ message: 'Image uploaded.', imageUrl, images: [imageUrl, ...extras], material: updated });
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
        // All photos currently on this material, primary first.
        const all = [
            ...(existing.imageUrl ? [existing.imageUrl] : []),
            ...(existing.images || []).filter((i) => i && i !== existing.imageUrl),
        ];
        if (all.length === 0)
            return res.status(200).json({ message: 'No image to remove.' });
        // ?url=<photo> (Sept 2026, multi-photo) removes just that one photo;
        // with no url it removes the primary photo, as it always has — and
        // the next photo (if any) is promoted to primary rather than
        // leaving the material photoless while extras still exist.
        const target = typeof req.query.url === 'string' && req.query.url ? String(req.query.url) : all[0];
        if (!all.includes(target))
            return res.status(404).json({ error: 'That photo is not on this material.' });
        await (0, firebaseStorageService_1.deleteMaterialImage)(target);
        const remaining = all.filter((i) => i !== target);
        const updated = await prismaClient_1.default.material.update({
            where: { id },
            data: { images: remaining, imageUrl: remaining.length > 0 ? remaining[0] : null },
        });
        return res.status(200).json({ message: 'Image removed.', images: remaining, material: updated });
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
