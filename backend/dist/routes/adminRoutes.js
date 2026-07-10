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
const contactVerificationController_1 = require("../controllers/auth/contactVerificationController");
const productSuggestionController_1 = require("../controllers/admin/productSuggestionController");
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
// ── GET /admin/amazon/product?asin=XXX ─────────────────────────────────────
// Fetches Amazon.in product page and extracts meta info.
// Used by admin ProductForm to auto-fill name/description/image/price.
adminRouter.get('/amazon/product', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, async (req, res) => {
    const asin = req.query.asin?.trim().toUpperCase();
    if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
        return res.status(400).json({ error: 'Invalid ASIN' });
    }
    try {
        const url = `https://www.amazon.in/dp/${asin}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-IN,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });
        if (!response.ok) {
            return res.status(502).json({ error: 'Amazon returned ' + response.status });
        }
        const html = await response.text();
        // Parse meta tags
        const getMeta = (prop) => {
            const m = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
                ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
            return m?.[1]?.trim() ?? null;
        };
        const getTitle = () => {
            // Try og:title first, then <title>, then #productTitle
            const og = getMeta('og:title');
            if (og)
                return og;
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch)
                return titleMatch[1].replace(/ : Amazon.in.*$/i, '').trim();
            const spanMatch = html.match(/id="productTitle"[^>]*>\s*([^<]+)/i);
            return spanMatch?.[1]?.trim() ?? null;
        };
        const getPrice = () => {
            // Try multiple Amazon price selectors in HTML
            const patterns = [
                /class="a-price-whole"[^>]*>([\d,]+)/i,
                /"priceAmount":([\d.]+)/i,
                /id="priceblock_ourprice"[^>]*>[^\d]*([\d,]+)/i,
                /"price":"INR ([\d.]+)"/i,
            ];
            for (const p of patterns) {
                const m = html.match(p);
                if (m)
                    return parseFloat(m[1].replace(/,/g, ''));
            }
            return null;
        };
        const name = getTitle();
        const description = getMeta('og:description');
        const imageUrl = getMeta('og:image')
            ?? `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
        const price = getPrice();
        res.json({
            asin,
            name: name ?? `Amazon Product ${asin}`,
            description: description ?? '',
            imageUrl,
            price: price ?? 0,
            affiliateUrl: `https://www.amazon.in/dp/${asin}?tag=miniguru08-21`,
        });
    }
    catch (err) {
        console.error('Amazon proxy error:', err.message);
        // Return partial data with ASIN thumbnail so form still works
        res.json({
            asin,
            name: `Amazon Product ${asin}`,
            description: '',
            imageUrl: `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`,
            price: 0,
            affiliateUrl: `https://www.amazon.in/dp/${asin}?tag=miniguru08-21`,
        });
    }
});
// ==================== CONTACT-CHANGE APPROVAL QUEUE ====================
// Only ever populated when a verified email/phone change couldn't be
// auto-confirmed via OTP to the old contact (old contact unreachable).
adminRouter.get('/contact-change-requests', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, contactVerificationController_1.getPendingContactChangeRequests);
adminRouter.post('/contact-change-requests/:userId/approve', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, contactVerificationController_1.approveContactChange);
adminRouter.post('/contact-change-requests/:userId/reject', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, contactVerificationController_1.rejectContactChange);
// ==================== PRODUCT SUGGESTIONS ====================
adminRouter.get('/product-suggestions', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, productSuggestionController_1.listProductSuggestions);
adminRouter.put('/product-suggestions/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authorizeAdmin, productSuggestionController_1.updateProductSuggestion);
exports.default = adminRouter;
