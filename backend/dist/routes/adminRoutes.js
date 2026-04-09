"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productController_1 = require("../controllers/admin/ecom/productController");
const projectController_1 = require("../controllers/project/projectController");
const categoryController_1 = require("../controllers/admin/ecom/categoryController");
const categoryController_2 = require("../controllers/project/categoryController");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const authMiddleware_1 = require("../middleware/authMiddleware");
const upload_1 = require("../middleware/upload");
const userController_1 = require("../controllers/auth/userController");
const orderController_1 = require("../controllers/ecom/orderController");
const statsController_1 = require("../controllers/admin/statsController");
const videoApprovalController_1 = require("../controllers/admin/videoApprovalController");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const adminRouter = express_1.default.Router();
// ==================== PRODUCTS ====================
adminRouter.post('/product', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, (0, validationMiddleware_1.productValidationRules)(), upload_1.uploadImagesMiddleware, productController_1.createProduct);
adminRouter.put('/product/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, (0, validationMiddleware_1.idValidationRules)(), (0, validationMiddleware_1.productValidationRules)(), upload_1.uploadImagesMiddleware, productController_1.updateProduct);
adminRouter.delete('/product/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, (0, validationMiddleware_1.idValidationRules)(), productController_1.deleteProduct);
adminRouter.post('/product/category', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, categoryController_1.createProductCategory);
adminRouter.delete('/product/category/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, categoryController_1.deleteProductCategory);
adminRouter.put('/product/category/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, categoryController_1.updateProductCategory);
// ==================== PROJECT CATEGORIES ====================
adminRouter.post('/project/category', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, categoryController_2.createProjectCategory);
adminRouter.delete('/project/category/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, categoryController_2.deleteProjectCategory);
adminRouter.put('/project/category/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, categoryController_2.updateProjectCategory);
// ==================== USERS ====================
adminRouter.get('/users', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, userController_1.listUsers);
adminRouter.get('/users/:userId', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, userController_1.getUserById);
adminRouter.delete('/users/:userId', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, userController_1.deleteUserById);
adminRouter.put('/users/:userId', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, userController_1.updateUserDetails, validationMiddleware_1.updateUserValidationRules);
// ==================== PROJECTS ====================
adminRouter.delete('/project/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, projectController_1.deleteProjectByID);
// ==================== ORDERS ====================
adminRouter.get('/orders', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, orderController_1.getAllOrdersController);
// Admin — update order dispatch details
adminRouter.patch('/orders/:id/dispatch', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
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
        const order = await prismaClient_1.default.order.update({
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
    }
    catch (err) {
        console.error('Dispatch update error:', err);
        return res.status(500).json({ error: 'Failed to update dispatch details' });
    }
});
// ==================== STATS ====================
adminRouter.get('/stats', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, statsController_1.fetchStats);
// ==================== VIDEO APPROVALS ====================
adminRouter.get('/projects/pending', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, videoApprovalController_1.getPendingProjects);
adminRouter.post('/projects/:id/approve', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, videoApprovalController_1.approveProject);
adminRouter.post('/projects/:id/reject', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, videoApprovalController_1.rejectProject);
adminRouter.get('/drafts', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, videoApprovalController_1.getAllDrafts);
// ==================== ADMIN GOINS ====================
// NOTE: Goins = user.score. ScoreHistory is an embedded array on User.
adminRouter.get('/goins/users', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const users = await prismaClient_1.default.user.findMany({
            select: { id: true, name: true, email: true, score: true, scoreHistory: true }
        });
        res.json(users.map((u) => ({
            id: u.id, name: u.name, email: u.email,
            goinsBalance: u.score,
            totalEarned: u.scoreHistory.filter((h) => h.updatedScore > 0).reduce((s, h) => s + h.updatedScore, 0),
            totalSpent: Math.abs(u.scoreHistory.filter((h) => h.updatedScore < 0).reduce((s, h) => s + h.updatedScore, 0)),
        })));
    }
    catch (e) {
        res.status(500).json({ message: 'Failed to fetch goins data' });
    }
});
adminRouter.get('/goins/history/:userId', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: req.params.userId },
            select: { scoreHistory: true }
        });
        if (!user)
            return res.json([]);
        const history = [...(user.scoreHistory || [])].reverse().slice(0, 50);
        res.json(history.map((h, i) => ({
            id: i.toString(),
            type: h.updatedScore >= 0 ? 'CREDIT' : 'DEBIT',
            amount: h.updatedScore,
            description: 'Goins transaction',
            timestamp: h.time,
            balanceAfter: 0,
        })));
    }
    catch (e) {
        res.status(500).json({ message: 'Failed to fetch history' });
    }
});
adminRouter.post('/goins/adjust', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    try {
        const { userId, amount, reason } = req.body;
        if (!userId || !amount || amount === 0)
            return res.status(400).json({ message: 'Invalid input' });
        const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        const updated = await prismaClient_1.default.user.update({
            where: { id: userId },
            data: {
                score: { increment: amount },
                scoreHistory: {
                    push: { time: new Date(), updatedScore: amount }
                }
            }
        });
        res.json({ success: true, newBalance: updated.score });
    }
    catch (e) {
        res.status(500).json({ message: 'Failed to adjust goins' });
    }
});
exports.default = adminRouter;
