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

// Admin — update order dispatch details
adminRouter.patch('/orders/:id/dispatch', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const { courierName, trackingNumber, estimatedDelivery, fulfillmentStatus } = req.body;
  if (!courierName || !trackingNumber || !fulfillmentStatus) {
    return res.status(400).json({ error: 'courierName, trackingNumber and fulfillmentStatus are required' });
  }
  const validStatuses = ['PENDING_DISPATCH', 'DISPATCHED', 'DELIVERED'];
  if (!validStatuses.includes(fulfillmentStatus)) {
    return res.status(400).json({ error: 'Invalid fulfillmentStatus' });
  }
  try {
    const order = await prisma.order.update({
      where: { id },
      data: {
        fulfillmentStatus,
        courierName,
        trackingNumber,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
        dispatchedAt: fulfillmentStatus === 'DISPATCHED' ? new Date() : undefined,
      },
      include: { user: { select: { name: true, email: true } }, transaction: true },
    });
    return res.status(200).json(order);
  } catch (err) {
    console.error('Dispatch update error:', err);
    return res.status(500).json({ error: 'Failed to update dispatch details' });
  }
});

// ==================== STATS ====================
adminRouter.get('/stats', authenticateToken, authorizeAdmin, fetchStats);

// ==================== VIDEO APPROVALS ====================
adminRouter.get('/projects/pending', authenticateToken, authorizeAdmin, getPendingProjects);
adminRouter.post('/projects/:id/approve', authenticateToken, authorizeAdmin, approveProject);
adminRouter.post('/projects/:id/reject', authenticateToken, authorizeAdmin, rejectProject);
adminRouter.get('/drafts', authenticateToken, authorizeAdmin, getAllDrafts);

// ==================== ADMIN GOINS ====================
// NOTE: Goins = user.score. ScoreHistory is an embedded array on User.

adminRouter.get('/goins/users', authenticateToken, authorizeAdmin, async (req: any, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, score: true, scoreHistory: true }
    });
    res.json(users.map((u: any) => ({
      id: u.id, name: u.name, email: u.email,
      goinsBalance: u.score,
      totalEarned: u.scoreHistory.filter((h: any) => h.updatedScore > 0).reduce((s: number, h: any) => s + h.updatedScore, 0),
      totalSpent:  Math.abs(u.scoreHistory.filter((h: any) => h.updatedScore < 0).reduce((s: number, h: any) => s + h.updatedScore, 0)),
    })));
  } catch (e) { res.status(500).json({ message: 'Failed to fetch goins data' }); }
});

adminRouter.get('/goins/history/:userId', authenticateToken, authorizeAdmin, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { scoreHistory: true }
    });
    if (!user) return res.json([]);
    const history = [...(user.scoreHistory || [])].reverse().slice(0, 50);
    res.json(history.map((h: any, i: number) => ({
      id: i.toString(),
      type: h.updatedScore >= 0 ? 'CREDIT' : 'DEBIT',
      amount: h.updatedScore,
      description: 'Goins transaction',
      timestamp: h.time,
      balanceAfter: 0,
    })));
  } catch (e) { res.status(500).json({ message: 'Failed to fetch history' }); }
});

adminRouter.post('/goins/adjust', authenticateToken, authorizeAdmin, async (req: any, res) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || !amount || amount === 0) return res.status(400).json({ message: 'Invalid input' });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        score: { increment: amount },
        scoreHistory: {
          push: { time: new Date(), updatedScore: amount }
        }
      }
    });
    res.json({ success: true, newBalance: updated.score });
  } catch (e) { res.status(500).json({ message: 'Failed to adjust goins' }); }
});

export default adminRouter;