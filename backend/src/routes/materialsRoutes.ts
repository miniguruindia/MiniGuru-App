import express from 'express';
import prisma from '../utils/prismaClient';
import logger from '../logger';

const router = express.Router();

// GET /materials
router.get('/', async (req, res) => {
  try {
    const { categoryId } = req.query;
    const where = categoryId ? { categoryId: categoryId as string } : {};
    const materials = await prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true, icon: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json(materials);
  } catch (error) {
    logger.error(`GET /materials error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch materials.' });
  }
});

// GET /materials/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
    return res.json(categories);
  } catch (error) {
    logger.error(`GET /materials/categories error: ${(error as Error).message}`);
    return res.status(500).json({ message: 'Failed to fetch material categories.' });
  }
});

export default router;