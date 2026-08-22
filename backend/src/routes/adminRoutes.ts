import express from 'express';
import { createProduct, updateProduct, deleteProduct } from '../controllers/admin/ecom/productController';
import { deleteProjectByID, adminUpdateProject } from '../controllers/project/projectController';
import { createProductCategory, deleteProductCategory, updateProductCategory} from '../controllers/admin/ecom/categoryController';
import { createProjectCategory, deleteProjectCategory, updateProjectCategory } from '../controllers/project/categoryController';
import { productValidationRules, idValidationRules, updateUserValidationRules } from '../middleware/validationMiddleware';
import { authenticateToken , authorizeAdmin } from '../middleware/authMiddleware';
import { uploadImagesMiddleware} from '../middleware/upload';
import { listUsers, getUserById , deleteUserById, updateUserDetails } from '../controllers/auth/userController';
import { getAllOrdersController } from '../controllers/ecom/orderController';
import { fetchStats } from '../controllers/admin/statsController';
import { getWebsiteAnalyticsSummary } from '../services/googleAnalyticsService';
import { getPendingProjects, approveProject, rejectProject, getAllDrafts } from '../controllers/admin/videoApprovalController';
import {
  getPendingContactChangeRequests,
  approveContactChange,
  rejectContactChange,
} from '../controllers/auth/contactVerificationController';
import { listProductSuggestions, updateProductSuggestion } from '../controllers/admin/productSuggestionController';
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
adminRouter.put('/project/:id', authenticateToken, authorizeAdmin, adminUpdateProject);

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
adminRouter.get('/analytics/website', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const summary = await getWebsiteAnalyticsSummary();
    res.json(summary);
  } catch (e) {
    res.json({ configured: false, error: 'Failed to load website analytics' });
  }
});

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
      select: { scoreHistory: true, score: true }
    });
    if (!user) return res.json([]);
    // scoreHistory is stored oldest-first. Walk it newest-first, starting
    // from the user's real current score and subtracting each entry's
    // delta as we go back — gives a genuine running balance instead of
    // the previous hardcoded balanceAfter: 0.
    const chronological = user.scoreHistory || [];
    let runningBalance = user.score;
    const withBalance = chronological.map((h: any) => {
      const entry = { ...h, balanceAfter: runningBalance };
      runningBalance -= h.updatedScore;
      return entry;
    });
    const history = withBalance.reverse().slice(0, 50);
    res.json(history.map((h: any, i: number) => ({
      id: i.toString(),
      type: h.updatedScore >= 0 ? 'CREDIT' : 'DEBIT',
      amount: h.updatedScore,
      // BUGFIX: was a hardcoded 'Goins transaction' string for every
      // entry — now shows the real, specific reason when one was
      // recorded (project approvals, challenge bonuses, manual admin
      // adjustments), falling back only for older entries from before
      // reasons were tracked.
      description: h.reason || 'Goins transaction',
      timestamp: h.time,
      balanceAfter: h.balanceAfter,
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
          // BUGFIX: `reason` was destructured from the request but never
          // actually saved — every admin adjustment showed up in history
          // with no explanation at all, no matter what the admin typed.
          push: { time: new Date(), updatedScore: amount, reason: reason || 'Manual admin adjustment' }
        }
      }
    });
    res.json({ success: true, newBalance: updated.score });
  } catch (e) { res.status(500).json({ message: 'Failed to adjust goins' }); }
});


// ── GET /admin/amazon/product?asin=XXX ─────────────────────────────────────
// Fetches Amazon.in product page and extracts meta info.
// Used by admin ProductForm to auto-fill name/description/image/price.
adminRouter.get('/amazon/product', authenticateToken, authorizeAdmin, async (req: any, res: any) => {
  const asin = (req.query.asin as string)?.trim().toUpperCase();
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
    const getMeta = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
             ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
      return m?.[1]?.trim() ?? null;
    };

    const getTitle = () => {
      // Try og:title first, then <title>, then #productTitle
      const og = getMeta('og:title');
      if (og) return og;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) return titleMatch[1].replace(/ : Amazon.in.*$/i, '').trim();
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
        if (m) return parseFloat(m[1].replace(/,/g, ''));
      }
      return null;
    };

    const name        = getTitle();
    const description = getMeta('og:description');
    const imageUrl    = getMeta('og:image')
                     ?? `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
    const price       = getPrice();

    res.json({
      asin,
      name:        name        ?? `Amazon Product ${asin}`,
      description: description ?? '',
      imageUrl,
      price:       price       ?? 0,
      affiliateUrl: `https://www.amazon.in/dp/${asin}?tag=miniguru04-21`,
    });
  } catch (err: any) {
    console.error('Amazon proxy error:', err.message);
    // Return partial data with ASIN thumbnail so form still works
    res.json({
      asin,
      name:        `Amazon Product ${asin}`,
      description: '',
      imageUrl: `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`,
      price: 0,
      affiliateUrl: `https://www.amazon.in/dp/${asin}?tag=miniguru04-21`,
    });
  }
});

// ==================== CONTACT-CHANGE APPROVAL QUEUE ====================
// Only ever populated when a verified email/phone change couldn't be
// auto-confirmed via OTP to the old contact (old contact unreachable).
adminRouter.get('/contact-change-requests', authenticateToken, authorizeAdmin, getPendingContactChangeRequests);
adminRouter.post('/contact-change-requests/:userId/approve', authenticateToken, authorizeAdmin, approveContactChange);
adminRouter.post('/contact-change-requests/:userId/reject', authenticateToken, authorizeAdmin, rejectContactChange);

// ==================== PRODUCT SUGGESTIONS ====================
adminRouter.get('/product-suggestions', authenticateToken, authorizeAdmin, listProductSuggestions);
adminRouter.put('/product-suggestions/:id', authenticateToken, authorizeAdmin, updateProductSuggestion);

export default adminRouter;