import express from 'express';
import { createProduct, updateProduct, deleteProduct } from '../controllers/admin/ecom/productController';
import { deleteProjectByID } from '../controllers/project/projectController';
import { createProductCategory, deleteProductCategory, updateProductCategory} from '../controllers/admin/ecom/categoryController';
import { createProjectCategory, deleteProjectCategory, updateProjectCategory } from '../controllers/project/categoryController';
import { productValidationRules, idValidationRules, updateUserValidationRules } from '../middleware/validationMiddleware';
import { authenticateToken , authorizeAdmin } from '../middleware/authMiddleware';
import { uploadImagesMiddleware} from '../middleware/upload';
import { listUsers, getUserById , deleteUserById, updateUserDetails } from '../controllers/auth/userController';
import { getAllOrdersController } from '../controllers/ecom/orderController';
import { fetchStats } from '../controllers/admin/statsController';
import { getPendingProjects, approveProject, rejectProject, getAllDrafts } from '../controllers/admin/videoApprovalController';
import prisma from '../utils/prismaClient';

const adminRouter = express.Router();

// ==================== PRODUCTS ====================
adminRouter.post('/product', authenticateToken, authorizeAdmin, productValidationRules(), uploadImagesMiddleware, createProduct);
adminRouter.put('/product/:id', authenticateToken, authorizeAdmin, idValidationRules(), productValidationRules(), uploadImagesMiddleware, updateProduct);
adminRouter.delete('/product/:id', authenticateToken, authorizeAdmin, idValidationRules(), deleteProduct);
adminRouter.post('/product/category', authenticateToken, authorizeAdmin, createProductCategory);
adminRouter.delete('/product/category/:id', authenticateToken, authorizeAdmin, deleteProductCategory);
adminRouter.put('/product/category/:id', authenticateToken, authorizeAdmin, updateProductCategory);

// ==================== PROJECT CATEGORIES ====================
adminRouter.post('/project/category', authenticateToken, authorizeAdmin, createProjectCategory);
adminRouter.delete('/project/category/:id', authenticateToken, authorizeAdmin, deleteProjectCategory);
adminRouter.put('/project/category/:id', authenticateToken, authorizeAdmin, updateProjectCategory);

// ==================== USERS ====================
adminRouter.get('/users', authenticateToken, authorizeAdmin, listUsers);
adminRouter.get('/users/:userId', authenticateToken, authorizeAdmin, getUserById);
adminRouter.delete('/users/:userId', authenticateToken, authorizeAdmin, deleteUserById);
adminRouter.put('/users/:userId', authenticateToken, authorizeAdmin, updateUserDetails, updateUserValidationRules);

// ==================== PROJECTS ====================
adminRouter.delete('/project/:id', authenticateToken, authorizeAdmin, deleteProjectByID);

// ==================== ORDERS ====================
adminRouter.get('/orders', authenticateToken, authorizeAdmin, getAllOrdersController);

// ==================== STATS ====================
adminRouter.get('/stats', authenticateToken, authorizeAdmin, fetchStats);

// ==================== VIDEO APPROVALS ====================
adminRouter.get('/projects/pending', authenticateToken, authorizeAdmin, getPendingProjects);
adminRouter.post('/projects/:id/approve', authenticateToken, authorizeAdmin, approveProject);
adminRouter.post('/projects/:id/reject', authenticateToken, authorizeAdmin, rejectProject);
adminRouter.get('/drafts', authenticateToken, authorizeAdmin, getAllDrafts);

// ==================== ADMIN GOINS ====================
adminRouter.get('/goins/users', authenticateToken, authorizeAdmin, async (req: any, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      include: { user: { select: { id: true, name: true, email: true } }, transactions: true }
    });
    const users = wallets.map((w: any) => ({
      id: w.user.id, name: w.user.name, email: w.user.email,
      goinsBalance: w.balance,
      totalEarned: w.transactions.filter((t: any) => t.type === 'CREDIT').reduce((s: number, t: any) => s + t.amount, 0),
      totalSpent:  w.transactions.filter((t: any) => t.type === 'DEBIT').reduce((s: number, t: any) => s + t.amount, 0),
    }));
    res.json(users);
  } catch (e) { res.status(500).json({ message: 'Failed to fetch goins data' }); }
});

adminRouter.get('/goins/history/:userId', authenticateToken, authorizeAdmin, async (req: any, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.params.userId } });
    if (!wallet) return res.json([]);
    const txns = await prisma.transaction.findMany({
      where: { walletId: wallet.id }, orderBy: { createdAt: 'desc' }, take: 50
    });
    res.json(txns.map((t: any) => ({
      id: t.id, type: t.type,
      amount: t.type === 'DEBIT' ? -t.amount : t.amount,
      description: t.status, timestamp: t.createdAt, balanceAfter: 0,
    })));
  } catch (e) { res.status(500).json({ message: 'Failed to fetch history' }); }
});

adminRouter.post('/goins/adjust', authenticateToken, authorizeAdmin, async (req: any, res) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || !amount || amount === 0) return res.status(400).json({ message: 'Invalid input' });
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
    const [updated] = await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } }),
      prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amount: Math.abs(amount),
          type: amount > 0 ? 'CREDIT' : 'DEBIT',
          status: reason || 'Admin adjustment'
        }
      }),
    ]);
    res.json({ success: true, newBalance: updated.balance });
  } catch (e) { res.status(500).json({ message: 'Failed to adjust goins' }); }
});

export default adminRouter;