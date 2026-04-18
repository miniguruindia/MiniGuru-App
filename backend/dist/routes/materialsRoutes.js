"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// ─── Helper: require ADMIN or SUPERADMIN ─────────────────────────────────────
function requireAdmin(req, res, next) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
// ─── Shape mapper: converts DB Material → shape Flutter MaterialItem.fromJson expects ─
// Flutter reads: id, name, categoryId, categoryName, goinsPerUnit, unit, imageUrl, isAvailable
// We map: category string → both categoryName AND categoryId (slug)
function toFlutterShape(m) {
    return {
        id: m.id,
        name: m.name,
        description: m.description,
        imageUrl: m.imageUrl,
        icon: m.icon,
        // Flutter reads categoryName and categoryId separately
        categoryName: m.category,
        categoryId: m.category.toLowerCase().replace(/\s+/g, '_'), // slug — no ObjectId needed
        category: m.category,
        unit: m.unit || 'piece',
        // Flutter reads goinsPerUnit first, then goinsPrice as fallback
        goinsPerUnit: m.goinsPrice,
        goinsPrice: m.goinsPrice,
        price: m.goinsPrice, // legacy fallback — MaterialItem.fromJson reads json['price']
        isAvailable: m.isActive,
        isActive: m.isActive,
        createdAt: m.createdAt,
    };
}
// ════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES — no auth needed (Flutter calls these without a token)
// ════════════════════════════════════════════════════════════════════════════
// GET /materials
// Returns all active materials — Flutter material_picker_widget calls this
router.get('/', async (req, res) => {
    try {
        const { category, categoryId } = req.query;
        const where = { isActive: true };
        // Support both ?category=Electronics and ?categoryId=electronics (Flutter compat)
        if (category) {
            where.category = String(category);
        }
        else if (categoryId) {
            // categoryId in Flutter is the slug e.g. "electronics"
            // Match case-insensitively by rebuilding from slug
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
// GET /materials/categories
// Returns category list in the shape Flutter MaterialCategory.fromJson expects:
// { id, name, emoji }
router.get('/categories', async (_req, res) => {
    try {
        const results = await prismaClient_1.default.material.findMany({
            where: { isActive: true },
            select: { category: true, icon: true },
            distinct: ['category'],
            orderBy: { category: 'asc' },
        });
        // Map to MaterialCategory shape: { id (slug), name, emoji }
        const categories = results.map((r) => ({
            id: r.category.toLowerCase().replace(/\s+/g, '_'),
            name: r.category,
            emoji: r.icon || '📦', // use the first found icon for that category
        }));
        res.json(categories);
    }
    catch (err) {
        console.error('[materials] GET /categories error:', err);
        res.status(500).json({ message: 'Failed to fetch material categories.' });
    }
});
// GET /materials/:id
// Single material detail
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
// ════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES — require auth + admin role
// ════════════════════════════════════════════════════════════════════════════
// GET /materials/admin/all — includes inactive items
router.get('/admin/all', authMiddleware_1.authenticateToken, requireAdmin, async (_req, res) => {
    try {
        const materials = await prismaClient_1.default.material.findMany({
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
        res.json(materials); // raw DB shape for admin panel
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch materials' });
    }
});
// POST /materials/admin/create — single create
router.post('/admin/create', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, imageUrl, icon, category, unit, goinsPrice } = req.body;
        if (!name || !category || goinsPrice === undefined) {
            return res.status(400).json({ error: 'name, category, and goinsPrice are required' });
        }
        const material = await prismaClient_1.default.material.create({
            data: {
                name: String(name).trim(),
                description: description ? String(description).trim() : null,
                imageUrl: imageUrl ? String(imageUrl).trim() : null,
                icon: icon ? String(icon).trim() : null,
                category: String(category).trim(),
                unit: unit ? String(unit).trim() : 'piece',
                goinsPrice: Number(goinsPrice),
            },
        });
        res.status(201).json(material);
    }
    catch (err) {
        console.error('[materials] POST /admin/create error:', err);
        res.status(500).json({ error: 'Failed to create material' });
    }
});
// PUT /materials/admin/:id — update single material
router.put('/admin/:id', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, imageUrl, icon, category, unit, goinsPrice, isActive } = req.body;
        const data = {};
        if (name !== undefined)
            data.name = String(name).trim();
        if (description !== undefined)
            data.description = description ? String(description).trim() : null;
        if (imageUrl !== undefined)
            data.imageUrl = imageUrl ? String(imageUrl).trim() : null;
        if (icon !== undefined)
            data.icon = icon ? String(icon).trim() : null;
        if (category !== undefined)
            data.category = String(category).trim();
        if (unit !== undefined)
            data.unit = String(unit).trim();
        if (goinsPrice !== undefined)
            data.goinsPrice = Number(goinsPrice);
        if (isActive !== undefined)
            data.isActive = Boolean(isActive);
        const material = await prismaClient_1.default.material.update({
            where: { id: req.params.id },
            data,
        });
        res.json(material);
    }
    catch (err) {
        if (err?.code === 'P2025')
            return res.status(404).json({ error: 'Material not found' });
        res.status(500).json({ error: 'Failed to update material' });
    }
});
// DELETE /materials/admin/:id — soft delete (sets isActive: false)
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
// POST /materials/admin/bulk
// Bulk create from JSON array
// Body: { materials: [ { name, category, goinsPrice, unit?, description?, imageUrl?, icon? } ] }
// Returns: { created: N, skipped: N, errors: [ { row, name, error } ] }
router.post('/admin/bulk', authMiddleware_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { materials } = req.body;
        if (!Array.isArray(materials) || materials.length === 0) {
            return res.status(400).json({ error: 'Body must be { materials: [...] }' });
        }
        const results = {
            created: 0,
            skipped: 0,
            errors: [],
        };
        for (let i = 0; i < materials.length; i++) {
            const m = materials[i];
            try {
                if (!m.name || !m.category || m.goinsPrice === undefined) {
                    results.errors.push({ row: i + 1, name: m.name || '(unnamed)', error: 'Missing name, category, or goinsPrice' });
                    results.skipped++;
                    continue;
                }
                // Skip exact duplicates (same name + category)
                const existing = await prismaClient_1.default.material.findFirst({
                    where: { name: String(m.name).trim(), category: String(m.category).trim() },
                });
                if (existing) {
                    results.errors.push({ row: i + 1, name: m.name, error: 'Already exists — skipped' });
                    results.skipped++;
                    continue;
                }
                await prismaClient_1.default.material.create({
                    data: {
                        name: String(m.name).trim(),
                        description: m.description ? String(m.description).trim() : null,
                        imageUrl: m.imageUrl ? String(m.imageUrl).trim() : null,
                        icon: m.icon ? String(m.icon).trim() : null,
                        category: String(m.category).trim(),
                        unit: m.unit ? String(m.unit).trim() : 'piece',
                        goinsPrice: Number(m.goinsPrice),
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
exports.default = router;
