"use strict";
// backend/src/services/geminiProductService.ts
//
// Admin-only fallback for when Amazon's API does not answer (for example
// "account does not meet eligibility"). Gemini searches the public web and
// proposes products. It has NO live Amazon feed, so everything it returns is
// marked unverified: the price is an estimate, the ASIN may be wrong, and the
// admin must open the tagged link and check before linking. Never throws.
Object.defineProperty(exports, "__esModule", { value: true });
exports.taggedSearchUrl = taggedSearchUrl;
exports.geminiFindProducts = geminiFindProducts;
exports.geminiDescribeProduct = geminiDescribeProduct;
const genai_1 = require("@google/genai");
const costTracking_1 = require("../utils/costTracking");
const MODEL = 'gemini-3.5-flash';
const TAG = 'miniguru04-21';
function client() {
    const k = process.env.GEMINI_API_KEY;
    if (!k)
        return null;
    try {
        return new genai_1.GoogleGenAI({ apiKey: k });
    }
    catch {
        return null;
    }
}
function taggedSearchUrl(q) {
    return 'https://www.amazon.in/s?k=' + encodeURIComponent(q) + '&tag=' + TAG;
}
function parseJson(text) {
    const t = String(text || '').replace(/```json|```/g, '');
    const a = t.indexOf('[');
    const b = t.lastIndexOf(']');
    const o1 = t.indexOf('{');
    const o2 = t.lastIndexOf('}');
    try {
        if (a >= 0 && b > a && (o1 < 0 || a < o1))
            return JSON.parse(t.slice(a, b + 1));
        if (o1 >= 0 && o2 > o1)
            return JSON.parse(t.slice(o1, o2 + 1));
    }
    catch { /* fall through */ }
    return null;
}
function isQuotaError(err) {
    const t = String(err?.message || err || '');
    return /429|RESOURCE_EXHAUSTED|quota/i.test(t);
}
function unitFromTitle(title) {
    const m = title.match(/\b(pack of \d+|set of \d+|\d+\s*(?:pcs|pieces|pc|pack|units)|\d+(?:\.\d+)?\s*(?:ml|l|g|kg|mm|cm|m))\b/i);
    return m ? m[0].trim() : null;
}
function toCandidate(x) {
    const title = String(x?.title || '').trim().slice(0, 160);
    if (!title)
        return null;
    let asin = String(x?.asin || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin))
        asin = '';
    const p = Number(String(x?.price ?? '').replace(/[^0-9.]/g, ''));
    return {
        asin,
        title,
        imageUrl: null,
        priceRupees: Number.isFinite(p) && p > 0 && p < 500000 ? Math.round(p) : null,
        detailPageUrl: asin ? 'https://www.amazon.in/dp/' + asin + '?tag=' + TAG : taggedSearchUrl(title),
        available: true,
        extractedUnit: unitFromTitle(title),
        source: 'gemini',
        unverified: true,
        note: x?.note ? String(x.note).slice(0, 140) : undefined,
    };
}
/** Propose up to 5 products for a material name. Cheapest estimate first. */
async function geminiFindProducts(query, description, avoidTitles = []) {
    const ai = client();
    if (!ai)
        return { ok: false, results: [], error: 'Gemini is not configured.' };
    if (!(await (0, costTracking_1.checkGeminiHelperQuota)())) {
        return { ok: false, results: [], error: "Today's Gemini helper limit is used up. It resets tomorrow." };
    }
    await (0, costTracking_1.recordGeminiHelperCall)();
    const base = `You help a children's STEAM-education shop in India find products on amazon.in.
Material: "${query}"
${description ? 'Details: "' + String(description).slice(0, 200) + '"\n' : ''}${avoidTitles.length ? 'Do not suggest anything like these rejected products:\n' + avoidTitles.map((t) => '- ' + t).join('\n') + '\n' : ''}`;
    const withSearch = base + `Use Google Search. Find up to 5 real, different products sold on amazon.in that match, cheapest first.
For each give: title, asin (the 10-character code, ONLY if you actually saw it in an amazon.in/dp/ address, otherwise empty string), price (approximate rupees as a number, or null), note (one short line, for example pack size).
Reply with ONLY a JSON array like [{"title":"...","asin":"","price":199,"note":"..."}]. Never invent an asin.`;
    const plain = base + `Without searching, suggest up to 5 typical products a parent could buy on amazon.in for this material, cheapest kind first.
For each give: title (a good Amazon search phrase with pack size), asin (always empty string), price (approximate rupees as a number, or null), note (one short line).
Reply with ONLY a JSON array like [{"title":"...","asin":"","price":199,"note":"..."}].`;
    const run = async (prompt, search) => {
        const r = await ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: search ? { tools: [{ googleSearch: {} }] } : undefined,
        });
        const arr = parseJson(r?.text ?? '');
        if (!Array.isArray(arr))
            throw new Error('no usable answer');
        return arr;
    };
    let arr = null;
    let searched = true;
    try {
        arr = await run(withSearch, true);
    }
    catch (e1) {
        // Web search is often not allowed on a free key: try again without it.
        console.error('[geminiProductService] search mode failed:', String(e1?.message || e1).slice(0, 300));
        searched = false;
        try {
            arr = await run(plain, false);
        }
        catch (e2) {
            console.error('[geminiProductService] plain mode failed:', String(e2?.message || e2).slice(0, 300));
            return {
                ok: false,
                results: [],
                error: isQuotaError(e2)
                    ? "Gemini's free daily limit is used up. Try again tomorrow."
                    : 'Gemini could not answer. Try again in a minute.',
            };
        }
    }
    const out = (arr || []).map(toCandidate).filter(Boolean);
    if (!searched)
        out.forEach((c) => { c.asin = ''; c.detailPageUrl = taggedSearchUrl(c.title); c.note = (c.note ? c.note + ' · ' : '') + 'name only (no web search)'; });
    out.sort((a, b) => (a.priceRupees ?? Infinity) - (b.priceRupees ?? Infinity));
    return { ok: out.length > 0, results: out.slice(0, 5), error: out.length ? undefined : 'Gemini found nothing.' };
}
/** Try to read one product page. Returns null when Gemini could not read it. */
async function geminiDescribeProduct(asin) {
    const ai = client();
    if (!ai || !/^[A-Z0-9]{10}$/.test(asin))
        return null;
    if (!(await (0, costTracking_1.checkGeminiHelperQuota)()))
        return null;
    await (0, costTracking_1.recordGeminiHelperCall)();
    try {
        const url = 'https://www.amazon.in/dp/' + asin;
        const prompt = `Read this product page: ${url}
If you can read it, reply with ONLY a JSON object {"title":"...","price":number or null,"description":"one plain sentence for a parent, max 25 words"}.
If you cannot read it, reply with ONLY {"title":""}. Never guess.`;
        const r = await ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: { tools: [{ urlContext: {} }, { googleSearch: {} }] },
        });
        const o = parseJson(r?.text ?? '');
        const title = String(o?.title || '').trim().slice(0, 160);
        if (!title)
            return null;
        const p = Number(String(o?.price ?? '').replace(/[^0-9.]/g, ''));
        return {
            title,
            priceRupees: Number.isFinite(p) && p > 0 && p < 500000 ? Math.round(p) : null,
            extractedUnit: unitFromTitle(title),
            description: o?.description ? String(o.description).slice(0, 200) : null,
        };
    }
    catch (err) {
        console.error('[geminiProductService] describe failed:', err?.message || err);
        return null;
    }
}
