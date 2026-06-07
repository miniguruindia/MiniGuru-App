"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
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
// ── ADMIN ROUTES — must come before /:id ─────────────────────────────────────
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
                amazonUrl: asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru08-21') : null,
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
            data.amazonUrl = asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru08-21') : null;
        }
        console.log('[PUT /admin/:id] data to save:', data);
        const updated = await prismaClient_1.default.material.update({ where: { id }, data });
        console.log('[PUT /admin/:id] saved amazonASIN:', updated.amazonASIN);
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
                        amazonUrl: asin ? ('https://www.amazon.in/dp/' + asin + '?tag=miniguru08-21') : null,
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
