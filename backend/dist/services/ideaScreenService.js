"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patternScreen = patternScreen;
exports.geminiScreen = geminiScreen;
exports.screenIdea = screenIdea;
// Automatic check of a shared idea (Nov 2026): no phone numbers, emails, links, social handles
// or home addresses. Names are fine. Two steps: simple pattern check, then a short Gemini look at
// the text and the sketch. If Gemini is unavailable, the pattern check alone decides.
const genai_1 = require("@google/genai");
function patternScreen(text) {
    const t = text || '';
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(t))
        return { ok: false, reason: 'an email address' };
    if (/(https?:\/\/|www\.|\.com\b|\.in\b|\.org\b|\.net\b)/i.test(t))
        return { ok: false, reason: 'a web link' };
    const digits = t.replace(/[\s\-().+]/g, '');
    if (/\d{9,}/.test(digits))
        return { ok: false, reason: 'a phone number' };
    if (/(^|\s)@[A-Za-z0-9._]{3,}/.test(t))
        return { ok: false, reason: 'a social media name' };
    if (/\b(whatsapp|instagram|telegram|snapchat|call me|phone no|mobile no)\b/i.test(t))
        return { ok: false, reason: 'a way to contact you' };
    if (/\b(house no|flat no|plot no|near .* (chowk|road|market)|pin ?code)\b/i.test(t))
        return { ok: false, reason: 'a home address' };
    return { ok: true };
}
const PROMPT = `You check a project IDEA that a child (age 8-14) wants to share on a children's platform. Look at the text and the sketch (if any). Reply "block" ONLY if you see: a phone number, email, home address, social media handle or link, an ID card, a face photo of a child with contact details, or content clearly unsafe or unsuitable for children. A child's name is fine. A simple, imperfect idea is fine. Reply with ONLY JSON: {"ok": true|false, "reason": "a few simple words, e.g. 'a phone number in the sketch'"}`;
async function geminiScreen(title, description, sketchB64) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        return { ok: true };
    try {
        const ai = new genai_1.GoogleGenAI({ apiKey });
        const parts = [{ text: `${PROMPT}\n\nTitle: ${title}\nDescription: ${description}` }];
        if (sketchB64)
            parts.push({ inlineData: { mimeType: 'image/png', data: sketchB64 } });
        const r = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: [{ role: 'user', parts }] });
        const txt = String(r?.text ?? '').replace(/^```json\s*|\s*```$/g, '').trim();
        const j = JSON.parse(txt);
        if (j && j.ok === false)
            return { ok: false, reason: typeof j.reason === 'string' ? j.reason.slice(0, 80) : 'something that should not be shared' };
        return { ok: true };
    }
    catch {
        return { ok: true }; // Gemini not reachable: the pattern check has already passed
    }
}
async function screenIdea(title, description, materialsText, sketchB64) {
    const p = patternScreen(`${title}\n${description}\n${materialsText}`);
    if (!p.ok)
        return p;
    return geminiScreen(title, description, sketchB64);
}
