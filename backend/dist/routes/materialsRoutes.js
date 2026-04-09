"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const logger_1 = __importDefault(require("../logger"));
const router = express_1.default.Router();
// GET /materials
router.get('/', async (req, res) => {
    try {
        const { categoryId } = req.query;
        const where = categoryId ? { categoryId: categoryId } : {};
        const materials = await prismaClient_1.default.product.findMany({
            where,
            include: { category: { select: { id: true, name: true, icon: true } } },
            orderBy: { name: 'asc' },
        });
        return res.json(materials);
    }
    catch (error) {
        logger_1.default.error(`GET /materials error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to fetch materials.' });
    }
});
// GET /materials/categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await prismaClient_1.default.productCategory.findMany({ orderBy: { name: 'asc' } });
        return res.json(categories);
    }
    catch (error) {
        logger_1.default.error(`GET /materials/categories error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to fetch material categories.' });
    }
});
exports.default = router;
