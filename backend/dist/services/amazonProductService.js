"use strict";
// backend/src/services/amazonProductService.ts
//
// Wraps Amazon's CREATORS API — the successor to Product Advertising API
// 5.0, which Amazon retired on May 15, 2026. Uses the real
// `amazon-creator-api-sdk` package (OAuth2 client-credentials auth,
// credentialId/credentialSecret/version — NOT the old AWS-SigV4 Access
// Key/Secret Key pair).
//
// Same philosophy as before: never throws, never auto-links anything.
// A search returns candidates; a human (or an approval-queue flow) always
// makes the final call before anything is saved.
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAmazonProducts = searchAmazonProducts;
exports.getAmazonItems = getAmazonItems;
exports.getAmazonItemsWithSeller = getAmazonItemsWithSeller;
exports.extractAsinFromUrl = extractAsinFromUrl;
exports.buildAffiliateUrl = buildAffiliateUrl;
const { ApiClient, DefaultApi, GetItemsRequestContent, SearchItemsRequestContent } = require('amazon-creator-api-sdk');
const costTracking_1 = require("../utils/costTracking");
const MARKETPLACE = 'www.amazon.in';
const RESOURCES = [
    'images.primary.large',
    'itemInfo.title',
    'offersV2.listings.price',
    'offersV2.listings.availability',
];
function isConfigured() {
    return !!(process.env.AMAZON_CREATORS_CREDENTIAL_ID &&
        process.env.AMAZON_CREATORS_CREDENTIAL_SECRET &&
        process.env.AMAZON_CREATORS_VERSION &&
        process.env.AMAZON_CREATORS_PARTNER_TAG);
}
function getApi() {
    const client = new ApiClient();
    client.credentialId = process.env.AMAZON_CREATORS_CREDENTIAL_ID;
    client.credentialSecret = process.env.AMAZON_CREATORS_CREDENTIAL_SECRET;
    client.version = process.env.AMAZON_CREATORS_VERSION; // e.g. "3.2"
    return new DefaultApi(client);
}
// Best-effort quantity/unit extraction from a product title. Only returns
// a value when a recognisable pattern is confidently matched — anything
// ambiguous returns null so the admin fills it in by hand, never a guess.
function extractUnitFromTitle(title) {
    if (!title)
        return null;
    const patterns = [
        /\bpack of (\d+)\b/i,
        /\bset of (\d+)\b/i,
        /\b(\d+)\s*(?:pcs|pieces|pc)\b/i,
        /\b(\d+)\s*count\b/i,
        /\b(\d+(?:\.\d+)?)\s*(ml|l|litre|liter)\b/i,
        /\b(\d+(?:\.\d+)?)\s*(g|gm|gram|grams|kg|kilogram)\b/i,
        /\b(\d+)\s*(?:x|X)\s*(\d+(?:\.\d+)?)\s*(ml|g|kg|l)\b/i,
    ];
    for (const re of patterns) {
        const m = title.match(re);
        if (m)
            return m[0].trim();
    }
    return null;
}
function toCandidate(item) {
    if (!item?.asin)
        return null;
    const listing = item?.offersV2?.listings?.[0];
    const money = listing?.price?.money;
    const availability = listing?.availability;
    const title = item?.itemInfo?.title?.displayValue || '(no title)';
    return {
        asin: item.asin,
        title,
        imageUrl: item?.images?.primary?.large?.url || null,
        priceRupees: typeof money?.amount === 'number' ? money.amount : null,
        detailPageUrl: item?.detailPageURL || '',
        // Availability model varies by field; absence of an explicit
        // "out of stock"-style message is treated as available.
        available: !availability?.message || !/out of stock|unavailable/i.test(availability.message),
        extractedUnit: extractUnitFromTitle(title),
    };
}
/**
 * Search Amazon India for candidate products matching a free-text query.
 * Never throws — check `.configured` and `.error` rather than try/catch.
 */
async function searchAmazonProducts(query, itemCount = 5) {
    if (!isConfigured()) {
        return { configured: false, results: [] };
    }
    const trimmed = (query || '').trim();
    if (!trimmed) {
        return { configured: true, results: [], error: 'Empty search query' };
    }
    try {
        const api = getApi();
        const request = new SearchItemsRequestContent();
        request.partnerTag = process.env.AMAZON_CREATORS_PARTNER_TAG;
        request.keywords = trimmed;
        request.itemCount = Math.min(Math.max(itemCount, 1), 10);
        request.resources = RESOURCES;
        const response = await api.searchItems(MARKETPLACE, { searchItemsRequestContent: request });
        (0, costTracking_1.recordAmazonApiCall)().catch(() => { });
        const items = response?.searchResult?.items || [];
        const results = items.map(toCandidate).filter((r) => !!r);
        const errorMsgs = (response?.errors || []).map((e) => e?.message).filter(Boolean);
        return {
            configured: true,
            results,
            error: results.length === 0 && errorMsgs.length ? errorMsgs.join('; ') : undefined,
        };
    }
    catch (err) {
        const message = err?.response?.body?.errors?.[0]?.message ||
            err?.message ||
            'Amazon search failed';
        console.error('[amazonProductService] search failed:', message);
        return { configured: true, results: [], error: message };
    }
}
/**
 * Look up one or more known ASINs directly (cheaper than a search, and
 * used by the nightly refresh job to re-check price/availability drift on
 * ASINs already linked to a Material).
 */
async function getAmazonItems(asins) {
    if (!isConfigured()) {
        return { configured: false, results: [] };
    }
    const clean = asins.map((a) => a?.trim()).filter(Boolean);
    if (clean.length === 0) {
        return { configured: true, results: [] };
    }
    try {
        const api = getApi();
        const request = new GetItemsRequestContent();
        request.partnerTag = process.env.AMAZON_CREATORS_PARTNER_TAG;
        request.itemIds = clean.slice(0, 10); // Creators API caps batch size at 10
        request.resources = RESOURCES;
        const response = await api.getItems(MARKETPLACE, request);
        (0, costTracking_1.recordAmazonApiCall)().catch(() => { });
        const items = response?.itemsResult?.items || [];
        const results = items.map(toCandidate).filter((r) => !!r);
        const errorMsgs = (response?.errors || []).map((e) => e?.message).filter(Boolean);
        return {
            configured: true,
            results,
            error: errorMsgs.length ? errorMsgs.join('; ') : undefined,
        };
    }
    catch (err) {
        const message = err?.response?.body?.errors?.[0]?.message ||
            err?.message ||
            'Amazon lookup failed';
        console.error('[amazonProductService] getItems failed:', message);
        return { configured: true, results: [], error: message };
    }
}
const SELLER_RESOURCES = [
    ...RESOURCES,
    'offersV2.listings.merchantInfo',
    'customerReviews.count',
    'customerReviews.starRating',
];
// Sellers that are Amazon itself or its long-standing fulfilment partners.
const TRUSTED_SELLER = /amazon|appario|cloudtail/i;
/**
 * Same as getAmazonItems, plus seller name and customer rating. Asks Amazon
 * for the extra fields; if Amazon rejects them, quietly falls back to the plain
 * lookup so nothing that works today can break.
 */
async function getAmazonItemsWithSeller(asins) {
    if (!isConfigured())
        return { configured: false, results: [] };
    const clean = asins.map((a) => a?.trim()).filter(Boolean);
    if (clean.length === 0)
        return { configured: true, results: [] };
    try {
        const api = getApi();
        const request = new GetItemsRequestContent();
        request.partnerTag = process.env.AMAZON_CREATORS_PARTNER_TAG;
        request.itemIds = clean.slice(0, 10);
        request.resources = SELLER_RESOURCES;
        const response = await api.getItems(MARKETPLACE, request);
        (0, costTracking_1.recordAmazonApiCall)().catch(() => { });
        const items = response?.itemsResult?.items || [];
        const results = [];
        for (const item of items) {
            const c = toCandidate(item);
            if (!c)
                continue;
            const seller = item?.offersV2?.listings?.[0]?.merchantInfo?.name;
            const rating = item?.customerReviews?.starRating?.value;
            const count = item?.customerReviews?.count;
            c.seller = typeof seller === 'string' ? seller : null;
            c.rating = typeof rating === 'number' ? rating : null;
            c.reviewCount = typeof count === 'number' ? count : null;
            c.trusted = !!c.seller && TRUSTED_SELLER.test(c.seller);
            results.push(c);
        }
        if (results.length > 0)
            return { configured: true, results };
    }
    catch (err) {
        console.warn('[amazonProductService] seller lookup failed, using plain lookup:', err?.message);
    }
    return getAmazonItems(clean);
}
/** Pulls an ASIN out of an Amazon link (dp/, gp/product/, or ?asin=). */
function extractAsinFromUrl(raw) {
    const s = String(raw || '').trim();
    if (/^[A-Z0-9]{10}$/i.test(s))
        return s.toUpperCase();
    const m = s.match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/|[?&]asin=)([A-Z0-9]{10})(?:[/?&#]|$)/i);
    return m ? m[1].toUpperCase() : null;
}
/** Builds a standard affiliate product link for a given ASIN + tracking tag. */
function buildAffiliateUrl(asin, tag) {
    const partnerTag = tag || process.env.AMAZON_CREATORS_PARTNER_TAG || 'miniguru04-21';
    return `https://www.amazon.in/dp/${asin}?tag=${partnerTag}`;
}
