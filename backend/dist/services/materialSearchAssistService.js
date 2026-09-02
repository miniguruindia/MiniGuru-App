"use strict";
// backend/src/services/materialSearchAssistService.ts
//
// A thin Gemini assist layer that sits IN FRONT OF Amazon's PA API — never
// a replacement for it. Gemini has no live connection to Amazon's real
// stock/price data, so it never invents an ASIN or a price here. All it
// does is turn a vague admin-entered material name (optionally with a
// reference photo) into a better search phrase for PA API's SearchItemsV2,
// and — when PA API returns several plausible candidates — help point out
// which one looks like the best match. The admin still makes the final
// tap-to-link decision either way.
//
// Same never-throw philosophy as aiVideoReviewService.ts: on any failure
// (missing key, quota, malformed response) this just falls back to the
// original, unrefined name so the PA API search still runs.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refineSearchQuery = refineSearchQuery;
const fs_1 = __importDefault(require("fs"));
const genai_1 = require("@google/genai");
const MODEL = 'gemini-3.5-flash';
function getClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        return null;
    try {
        return new genai_1.GoogleGenAI({ apiKey });
    }
    catch {
        return null;
    }
}
/**
 * Turns a material name (and optional short description / photo) into a
 * concise Amazon-India search phrase. Falls back to the original name on
 * any failure — never throws, never blocks the PA API search that follows.
 */
async function refineSearchQuery(materialName, description, imageLocalPath) {
    const fallback = materialName.trim();
    const ai = getClient();
    if (!ai || !fallback)
        return fallback;
    try {
        const prompt = `You help find the right product on Amazon India for a children's STEAM-education materials catalog. Given a material name${description ? ' and description' : ''}, output ONLY the best short Amazon search phrase (3-6 words) to find that exact product — no explanation, no quotes, no punctuation besides spaces.

Material name: "${materialName}"
${description ? `Description: "${description}"` : ''}

Search phrase:`;
        const parts = [prompt];
        if (imageLocalPath && fs_1.default.existsSync(imageLocalPath)) {
            const bytes = fs_1.default.readFileSync(imageLocalPath);
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: bytes.toString('base64'),
                },
            });
        }
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: (0, genai_1.createUserContent)(parts),
        });
        const text = (response?.text ?? '').trim().replace(/^["']|["']$/g, '');
        return text.length > 0 && text.length < 120 ? text : fallback;
    }
    catch (err) {
        console.error('[materialSearchAssistService] refine failed, using raw name:', err);
        return fallback;
    }
}
