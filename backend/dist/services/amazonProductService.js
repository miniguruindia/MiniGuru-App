"use strict";
// backend/src/services/amazonProductService.ts
//
// Wraps Amazon's Product Advertising API (PA API 5.0) for admin-assisted
// material linking: given a search phrase, return a short list of real
// candidate products (title, image, ASIN, GST-inclusive price) so an admin
// can pick the correct one. This NEVER auto-links anything itself — matching
// the wrong product to a listing a parent will pay for is a trust problem,
// not just an accuracy one, so a human always makes the final call.
//
// Designed like aiVideoReviewService.ts: never throws. Missing credentials,
// network errors, or "not yet eligible for PA API" all resolve to a clean
// { configured: false } or { configured: true, results: [] } response rather
// than crashing the admin request.
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAmazonProducts = searchAmazonProducts;
exports.buildAffiliateUrl = buildAffiliateUrl;
// amazon-paapi has no TypeScript types published — require() keeps it `any`
// under this project's non-strict tsconfig rather than fighting an import.
const amazonPaapi = require('amazon-paapi');
function isConfigured() {
    return !!(process.env.AMAZON_PAAPI_ACCESS_KEY &&
        process.env.AMAZON_PAAPI_SECRET_KEY &&
        process.env.AMAZON_PAAPI_PARTNER_TAG);
}
/**
 * Search Amazon India for candidate products matching a free-text query.
 * Returns up to `itemCount` results. Never throws — check `.configured` and
 * `.error` in the response rather than wrapping this in try/catch.
 */
async function searchAmazonProducts(query, itemCount = 5) {
    if (!isConfigured()) {
        return { configured: false, results: [] };
    }
    const trimmed = (query || '').trim();
    if (!trimmed) {
        return { configured: true, results: [], error: 'Empty search query' };
    }
    const commonParameters = {
        AccessKey: process.env.AMAZON_PAAPI_ACCESS_KEY,
        SecretKey: process.env.AMAZON_PAAPI_SECRET_KEY,
        PartnerTag: process.env.AMAZON_PAAPI_PARTNER_TAG,
        PartnerType: 'Associates',
        Marketplace: 'www.amazon.in',
    };
    const requestParameters = {
        Keywords: trimmed,
        SearchIndex: 'All',
        ItemCount: Math.min(Math.max(itemCount, 1), 10),
        Resources: [
            'Images.Primary.Large',
            'ItemInfo.Title',
            'OffersV2.Listings.Price',
        ],
    };
    try {
        const data = await amazonPaapi.SearchItemsV2(commonParameters, requestParameters);
        const items = data?.SearchResult?.Items || [];
        const results = items.map((item) => {
            const listing = item?.OffersV2?.Listings?.[0];
            const priceMoney = listing?.Price?.Money;
            return {
                asin: item?.ASIN,
                title: item?.ItemInfo?.Title?.DisplayValue || '(no title)',
                imageUrl: item?.Images?.Primary?.Large?.URL || null,
                priceRupees: typeof priceMoney?.Amount === 'number' ? priceMoney.Amount : null,
                detailPageUrl: item?.DetailPageURL || '',
            };
        }).filter((r) => !!r.asin);
        return { configured: true, results };
    }
    catch (err) {
        // A "not yet eligible" / auth-failure PA API error lands here too —
        // surface the message so the admin UI can show something honest
        // ("PA API not active yet — 3 qualifying sales needed") instead of a
        // generic failure.
        const message = err?.response?.body?.Errors?.[0]?.Message ||
            err?.message ||
            'Amazon search failed';
        console.error('[amazonProductService] search failed:', message);
        return { configured: true, results: [], error: message };
    }
}
/** Builds a standard affiliate product link for a given ASIN + tracking tag. */
function buildAffiliateUrl(asin, tag) {
    const partnerTag = tag || process.env.AMAZON_PAAPI_PARTNER_TAG || 'miniguru04-21';
    return `https://www.amazon.in/dp/${asin}?tag=${partnerTag}`;
}
