// backend/src/controllers/admin/productSuggestionController.ts
//
// Admin-side resolution workflow for ProductSuggestion — the "suggest a
// material" box children see in the shop and the "custom item" flow in the
// material picker both write here.
//
//   pending  → just submitted, not yet reviewed
//   added    → admin approved it — a real Material now exists
//              (resolvedMaterialId set), created automatically by
//              approveProductSuggestion below
//   rejected → admin decided not to add it (adminNotes explains why)
//
// (Sept 2026) Collapsed from a 3-step pending -> approved -> added workflow
// to a single "Approve & Add" action per founder's instruction -- approving
// a child's suggestion now means it's immediately live as a real Material,
// autofilled from whatever the child gave (name is the only thing they're
// ever required to supply) plus whatever the Amazon AI scan already found
// for it (ASIN/price/photo/title). Admin can still edit every field
// afterward from the normal Materials tab, same as any other material.

import { Request, Response } from 'express';
import prisma from '../../utils/prismaClient';
import { buildAffiliateUrl } from '../../services/amazonProductService';

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
// Still used for: rejecting (status: 'rejected', with an optional
// adminNotes reason) and editing the admin note on a still-pending
// suggestion. No longer expected to ever set status to 'added' directly --
// use POST /admin/product-suggestions/:id/approve for that, which is the
// only path that also creates the Material.
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

// POST /admin/product-suggestions/:id/approve
//   body (all optional -- every field falls back to something sensible so
//   a bare-minimum "just a name" suggestion still creates a valid
//   Material; admin can override any of these before/via this call, or
//   edit the Material afterward from the Materials tab):
//     category, unit, goinsPrice, description
//
// Creates a real Material in the same action that marks the suggestion
// resolved, so "approved" and "added" can never drift apart again --
// exactly the gap that let a suggestion get marked added with nothing
// actually created.
export const approveProductSuggestion = async (req: Request, res: Response) => {
  const { id } = req.params;
  const overrides = (req.body || {}) as {
    category?: string;
    unit?: string;
    goinsPrice?: number;
    description?: string;
  };

  const suggestion = await prisma.productSuggestion.findUnique({ where: { id } });
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found.' });
  if (suggestion.resolvedMaterialId) {
    return res.status(400).json({ error: 'This suggestion was already approved.', resolvedMaterialId: suggestion.resolvedMaterialId });
  }

  // The internal tag used when a suggestion comes from the material
  // picker's "custom item" flow (rather than the shop's suggestion box)
  // isn't a real category -- never use it as one.
  const category =
    overrides.category?.trim() ||
    (suggestion.category && suggestion.category !== 'custom_material_request' ? suggestion.category : null) ||
    'Suggested by Children';

  const goinsPrice =
    typeof overrides.goinsPrice === 'number'
      ? overrides.goinsPrice
      : suggestion.requestedGoinsPrice ?? 10; // child's own suggested rate, else a neutral default

  const asin = suggestion.amazonAsinFound || undefined;

  try {
    const material = await prisma.material.create({
      data: {
        name: suggestion.suggestion,
        description: overrides.description ?? suggestion.amazonTitleFound ?? undefined,
        category,
        unit: overrides.unit?.trim() || 'piece',
        goinsPrice,
        imageUrl: suggestion.amazonImageUrlFound || undefined,
        priceEstimate: suggestion.amazonPriceFound ?? undefined,
        amazonASIN: asin,
        amazonUrl: asin ? buildAffiliateUrl(asin) : undefined,
        showInShop: true,
        showInPlanning: true,
      },
    });

    const updated = await prisma.productSuggestion.update({
      where: { id },
      data: {
        status: 'added',
        resolvedMaterialId: material.id,
        resolvedAt: new Date(),
      },
    });

    return res.status(200).json({ message: 'Material created from suggestion.', material, suggestion: updated });
  } catch (error) {
    return res.status(500).json({ error: `Could not create material: ${(error as Error).message}` });
  }
};
