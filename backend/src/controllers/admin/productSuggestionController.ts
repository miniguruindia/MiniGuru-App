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

import { Request, Response } from 'express';
import prisma from '../../utils/prismaClient';

// GET /admin/product-suggestions?status=pending
export const listProductSuggestions = async (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };
  const where = status ? { status } : {};
  const suggestions = await prisma.productSuggestion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json({ suggestions });
};

// PUT /admin/product-suggestions/:id
//   body: { status?, adminNotes?, resolvedMaterialId?, requestedGoinsPrice? }
export const updateProductSuggestion = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, adminNotes, resolvedMaterialId, requestedGoinsPrice } = req.body;

  const existing = await prisma.productSuggestion.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Suggestion not found.' });

  const data: any = {};
  if ('status' in req.body) data.status = status;
  if ('adminNotes' in req.body) data.adminNotes = adminNotes;
  if ('resolvedMaterialId' in req.body) data.resolvedMaterialId = resolvedMaterialId;
  if ('requestedGoinsPrice' in req.body) data.requestedGoinsPrice = requestedGoinsPrice;
  if (data.status && ['added', 'rejected'].includes(data.status) && !existing.resolvedAt) {
    data.resolvedAt = new Date();
  }

  const updated = await prisma.productSuggestion.update({ where: { id }, data });
  return res.status(200).json({ message: 'Suggestion updated.', suggestion: updated });
};