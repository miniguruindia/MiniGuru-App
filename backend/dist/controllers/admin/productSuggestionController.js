"use strict";
// backend/src/controllers/admin/productSuggestionController.ts
//
// Admin-side resolution workflow for ProductSuggestion — the "suggest a
// material" box children see in the shop and the "custom item" flow in the
// material picker both write here. Previously these just piled up with no
// way to act on them; this gives admin a status workflow:
//   pending  → just submitted, not yet reviewed
//   approved → admin likes it, plans to add it as a real Material soon
//   added    → admin actually created the Material (resolvedMaterialId set)
//   rejected → admin decided not to add it (adminNotes explains why)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProductSuggestion = exports.listProductSuggestions = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
// GET /admin/product-suggestions?status=pending
const listProductSuggestions = async (req, res) => {
    const { status } = req.query;
    const where = status ? { status } : {};
    const suggestions = await prismaClient_1.default.productSuggestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ suggestions });
};
exports.listProductSuggestions = listProductSuggestions;
// PUT /admin/product-suggestions/:id
//   body: { status?, adminNotes?, resolvedMaterialId?, requestedGoinsPrice? }
const updateProductSuggestion = async (req, res) => {
    const { id } = req.params;
    const { status, adminNotes, resolvedMaterialId, requestedGoinsPrice } = req.body;
    const existing = await prismaClient_1.default.productSuggestion.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: 'Suggestion not found.' });
    const data = {};
    if ('status' in req.body)
        data.status = status;
    if ('adminNotes' in req.body)
        data.adminNotes = adminNotes;
    if ('resolvedMaterialId' in req.body)
        data.resolvedMaterialId = resolvedMaterialId;
    if ('requestedGoinsPrice' in req.body)
        data.requestedGoinsPrice = requestedGoinsPrice;
    if (data.status && ['added', 'rejected'].includes(data.status) && !existing.resolvedAt) {
        data.resolvedAt = new Date();
    }
    const updated = await prismaClient_1.default.productSuggestion.update({ where: { id }, data });
    return res.status(200).json({ message: 'Suggestion updated.', suggestion: updated });
};
exports.updateProductSuggestion = updateProductSuggestion;
