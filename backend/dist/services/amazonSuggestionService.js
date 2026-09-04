"use strict";
// backend/src/services/amazonSuggestionService.ts
//
// The bulk-matching engine behind the admin "AI Suggestions" tab.
// Two jobs, both never-throw, both respect a time/rate budget so a single
// HTTP request can't run past Cloud Run's timeout:
//
//  1. runAmazonSuggestionScan() — for materials with NO ASIN yet: search,
//     refine with Gemini, optionally verify the photo, write a PENDING
//     AmazonSuggestion row. Never touches the Material itself.
//  2. runAmazonRefreshCheck() — for materials that ALREADY have an ASIN:
//     re-fetch price/availability, and if something drifted, flag the
//     Material (amazonNeedsAttention) rather than silently overwriting it.
//
// Both are designed to be safely re-run — they skip materials that already
// have a live PENDING suggestion or were checked very recently.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAmazonSuggestionScan = runAmazonSuggestionScan;
exports.runAmazonRefreshCheck = runAmazonRefreshCheck;
exports.approveAmazonSuggestion = approveAmazonSuggestion;
exports.rejectAmazonSuggestion = rejectAmazonSuggestion;
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const amazonProductService_1 = require("./amazonProductService");
const materialSearchAssistService_1 = require("./materialSearchAssistService");
const SCAN_DELAY_MS = 1100; // conservative spacing between Amazon calls
const SCAN_TIME_BUDGET_MS = 8 * 60 * 1000; // stay well under Cloud Run's 600s timeout
const PRICE_DRIFT_THRESHOLD = 0.15; // 15% price change flags for review
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Scans materials with no amazonASIN, up to `limit`, creating a PENDING
 * (or NO_MATCH) AmazonSuggestion for each. Skips any material that already
 * has an unresolved PENDING suggestion, so it's safe to run repeatedly.
 */
async function runAmazonSuggestionScan(limit = 25) {
    const startedAt = Date.now();
    const summary = {
        scanned: 0,
        suggested: 0,
        noMatch: 0,
        skipped: 0,
        stoppedEarly: false,
        suggestionsEnriched: 0,
    };
    const pendingMaterialIds = new Set((await prismaClient_1.default.amazonSuggestion.findMany({
        where: { status: 'PENDING' },
        select: { materialId: true },
    })).map((s) => s.materialId));
    const candidates = await prismaClient_1.default.material.findMany({
        where: { amazonASIN: null, isActive: true },
        take: limit * 2, // over-fetch a bit since some will be skipped (already pending)
        orderBy: { createdAt: 'asc' },
    });
    for (const material of candidates) {
        if (summary.scanned >= limit)
            break;
        if (Date.now() - startedAt > SCAN_TIME_BUDGET_MS) {
            summary.stoppedEarly = true;
            break;
        }
        if (pendingMaterialIds.has(material.id)) {
            summary.skipped += 1;
            continue;
        }
        try {
            const query = await (0, materialSearchAssistService_1.refineSearchQuery)(material.name, material.description || undefined);
            const search = await (0, amazonProductService_1.searchAmazonProducts)(query, 3);
            summary.scanned += 1;
            if (!search.configured) {
                summary.stoppedEarly = true;
                break; // no point continuing if credentials aren't set at all
            }
            const top = search.results[0];
            if (!top) {
                await prismaClient_1.default.amazonSuggestion.create({
                    data: {
                        materialId: material.id,
                        materialName: material.name,
                        searchedQuery: query,
                        status: 'NO_MATCH',
                        reason: search.error || 'No matching products found on Amazon.in',
                    },
                });
                summary.noMatch += 1;
            }
            else {
                let imageConfidence;
                let imageConfidenceNote;
                if (top.imageUrl) {
                    const check = await (0, materialSearchAssistService_1.verifyImageMatch)(material.name, top.title, top.imageUrl);
                    imageConfidence = check.confidence;
                    imageConfidenceNote = check.note;
                }
                await prismaClient_1.default.amazonSuggestion.create({
                    data: {
                        materialId: material.id,
                        materialName: material.name,
                        searchedQuery: query,
                        suggestedAsin: top.asin,
                        suggestedTitle: top.title,
                        suggestedImageUrl: top.imageUrl || undefined,
                        suggestedPriceRupees: top.priceRupees ?? undefined,
                        imageConfidence,
                        imageConfidenceNote,
                        status: 'PENDING',
                    },
                });
                summary.suggested += 1;
            }
        }
        catch (err) {
            console.error(`[amazonSuggestionService] scan failed for material ${material.id}:`, err);
            summary.skipped += 1;
        }
        await sleep(SCAN_DELAY_MS);
    }
    // Also enrich pending child-submitted material suggestions with an
    // Amazon candidate — never creates a Material itself, just gives the
    // admin a pre-fetched starting point when they review the suggestion.
    if (!summary.stoppedEarly && Date.now() - startedAt < SCAN_TIME_BUDGET_MS) {
        const pendingSuggestions = await prismaClient_1.default.productSuggestion.findMany({
            where: { status: 'pending', amazonSearchedAt: null },
            take: Math.max(limit - summary.scanned, 5),
            orderBy: { createdAt: 'asc' },
        });
        for (const ps of pendingSuggestions) {
            if (Date.now() - startedAt > SCAN_TIME_BUDGET_MS) {
                summary.stoppedEarly = true;
                break;
            }
            try {
                const query = await (0, materialSearchAssistService_1.refineSearchQuery)(ps.suggestion, ps.projectContext || undefined);
                const search = await (0, amazonProductService_1.searchAmazonProducts)(query, 3);
                if (!search.configured) {
                    summary.stoppedEarly = true;
                    break;
                }
                const top = search.results[0];
                await prismaClient_1.default.productSuggestion.update({
                    where: { id: ps.id },
                    data: {
                        amazonAsinFound: top?.asin || null,
                        amazonTitleFound: top?.title || null,
                        amazonImageUrlFound: top?.imageUrl || null,
                        amazonPriceFound: top?.priceRupees ?? null,
                        amazonSearchedAt: new Date(),
                    },
                });
                summary.suggestionsEnriched += 1;
            }
            catch (err) {
                console.error(`[amazonSuggestionService] suggestion enrich failed for ${ps.id}:`, err);
            }
            await sleep(SCAN_DELAY_MS);
        }
    }
    return summary;
}
/**
 * Re-checks already-linked materials' ASINs for price drift or the item
 * going unavailable. NEVER changes priceEstimate/imageUrl itself — only
 * flags amazonNeedsAttention so an admin decides. Oldest-checked first.
 */
async function runAmazonRefreshCheck(limit = 50) {
    const startedAt = Date.now();
    const summary = { checked: 0, flagged: 0, cleared: 0, stoppedEarly: false };
    const materials = await prismaClient_1.default.material.findMany({
        where: { amazonASIN: { not: null }, isActive: true },
        orderBy: [{ amazonLastCheckedAt: 'asc' }],
        take: limit,
    });
    // Amazon's getItems accepts up to 10 ASINs per call — batch accordingly.
    for (let i = 0; i < materials.length; i += 10) {
        if (Date.now() - startedAt > SCAN_TIME_BUDGET_MS) {
            summary.stoppedEarly = true;
            break;
        }
        const batch = materials.slice(i, i + 10);
        const asins = batch.map((m) => m.amazonASIN).filter(Boolean);
        const result = await (0, amazonProductService_1.getAmazonItems)(asins);
        if (!result.configured) {
            summary.stoppedEarly = true;
            break;
        }
        const byAsin = new Map(result.results.map((r) => [r.asin, r]));
        for (const material of batch) {
            summary.checked += 1;
            const live = material.amazonASIN ? byAsin.get(material.amazonASIN) : undefined;
            let needsAttention = false;
            let reason = null;
            if (!live) {
                needsAttention = true;
                reason = 'Amazon no longer returns this ASIN — item may have been removed.';
            }
            else if (!live.available) {
                needsAttention = true;
                reason = 'Currently shows as unavailable on Amazon.';
            }
            else if (material.priceEstimate != null &&
                live.priceRupees != null &&
                material.priceEstimate > 0) {
                const drift = Math.abs(live.priceRupees - material.priceEstimate) / material.priceEstimate;
                if (drift >= PRICE_DRIFT_THRESHOLD) {
                    needsAttention = true;
                    reason = `Price moved from your saved ₹${material.priceEstimate} to ₹${live.priceRupees} on Amazon.`;
                }
            }
            await prismaClient_1.default.material.update({
                where: { id: material.id },
                data: {
                    amazonNeedsAttention: needsAttention,
                    amazonAttentionReason: reason,
                    amazonLastCheckedAt: new Date(),
                },
            });
            if (needsAttention)
                summary.flagged += 1;
            else
                summary.cleared += 1;
        }
        await sleep(SCAN_DELAY_MS);
    }
    return summary;
}
/**
 * Applies a PENDING suggestion onto its Material. Only overwrites the
 * image if the material has none yet, unless `forceImage` is explicitly
 * passed — this is the one place an admin's explicit approval is allowed
 * to override Rule 30's default caution.
 */
async function approveAmazonSuggestion(suggestionId, adminId, forceImage = false) {
    const suggestion = await prismaClient_1.default.amazonSuggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion)
        throw new Error('Suggestion not found');
    if (suggestion.status !== 'PENDING')
        throw new Error('Suggestion already resolved');
    if (!suggestion.suggestedAsin)
        throw new Error('Suggestion has no ASIN to apply');
    const material = await prismaClient_1.default.material.findUnique({ where: { id: suggestion.materialId } });
    if (!material)
        throw new Error('Material no longer exists');
    const data = {
        amazonASIN: suggestion.suggestedAsin,
        amazonUrl: (0, amazonProductService_1.buildAffiliateUrl)(suggestion.suggestedAsin),
        amazonNeedsAttention: false,
        amazonAttentionReason: null,
        amazonLastCheckedAt: new Date(),
    };
    if (suggestion.suggestedPriceRupees != null)
        data.priceEstimate = suggestion.suggestedPriceRupees;
    if (suggestion.suggestedImageUrl && (!material.imageUrl || forceImage)) {
        data.imageUrl = suggestion.suggestedImageUrl;
    }
    const [updatedMaterial] = await prismaClient_1.default.$transaction([
        prismaClient_1.default.material.update({ where: { id: material.id }, data }),
        prismaClient_1.default.amazonSuggestion.update({
            where: { id: suggestionId },
            data: { status: 'APPROVED', resolvedAt: new Date(), resolvedByAdminId: adminId },
        }),
    ]);
    return updatedMaterial;
}
async function rejectAmazonSuggestion(suggestionId, adminId) {
    const suggestion = await prismaClient_1.default.amazonSuggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion)
        throw new Error('Suggestion not found');
    await prismaClient_1.default.amazonSuggestion.update({
        where: { id: suggestionId },
        data: { status: 'REJECTED', resolvedAt: new Date(), resolvedByAdminId: adminId },
    });
}
