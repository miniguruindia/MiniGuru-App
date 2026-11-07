// backend/src/services/geminiProductService.ts
//
// Admin-only fallback for when Amazon's API does not answer (for example
// "account does not meet eligibility"). Gemini searches the public web and
// proposes products. It has NO live Amazon feed, so everything it returns is
// marked unverified: the price is an estimate, the ASIN may be wrong, and the
// admin must open the tagged link and check before linking. Never throws.

import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-3.5-flash';
const TAG = 'miniguru04-21';

export interface GeminiCandidate {
  asin: string;                 // '' when Gemini could not give a code
  title: string;
  imageUrl: null;               // never an Amazon image (Rule 30)
  priceRupees: number | null;   // estimate
  detailPageUrl: string;        // tagged link (product page or tagged search)
  available: boolean;
  extractedUnit: string | null;
  source: 'gemini';
  unverified: true;
  note?: string;
}

export interface GeminiResult {
  ok: boolean;
  results: GeminiCandidate[];
  error?: string;
}

function client(): GoogleGenAI | null {
  const k = process.env.GEMINI_API_KEY;
  if (!k) return null;
  try { return new GoogleGenAI({ apiKey: k }); } catch { return null; }
}

export function taggedSearchUrl(q: string): string {
  return 'https://www.amazon.in/s?k=' + encodeURIComponent(q) + '&tag=' + TAG;
}

function parseJson(text: string): any {
  const t = String(text || '').replace(/```json|```/g, '');
  const a = t.indexOf('[');
  const b = t.lastIndexOf(']');
  const o1 = t.indexOf('{');
  const o2 = t.lastIndexOf('}');
  try {
    if (a >= 0 && b > a && (o1 < 0 || a < o1)) return JSON.parse(t.slice(a, b + 1));
    if (o1 >= 0 && o2 > o1) return JSON.parse(t.slice(o1, o2 + 1));
  } catch { /* fall through */ }
  return null;
}

function unitFromTitle(title: string): string | null {
  const m = title.match(/\b(pack of \d+|set of \d+|\d+\s*(?:pcs|pieces|pc|pack|units)|\d+(?:\.\d+)?\s*(?:ml|l|g|kg|mm|cm|m))\b/i);
  return m ? m[0].trim() : null;
}

function toCandidate(x: any): GeminiCandidate | null {
  const title = String(x?.title || '').trim().slice(0, 160);
  if (!title) return null;
  let asin = String(x?.asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) asin = '';
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
export async function geminiFindProducts(
  query: string,
  description?: string | null,
  avoidTitles: string[] = []
): Promise<GeminiResult> {
  const ai = client();
  if (!ai) return { ok: false, results: [], error: 'Gemini is not configured.' };
  try {
    const prompt = `You help a children's STEAM-education shop in India find products on amazon.in.
Use Google Search. Find up to 5 real, different products sold on amazon.in that match this material, cheapest first.
Material: "${query}"
${description ? 'Details: "' + String(description).slice(0, 200) + '"\n' : ''}${avoidTitles.length ? 'Do not suggest anything like these rejected products:\n' + avoidTitles.map((t) => '- ' + t).join('\n') + '\n' : ''}
For each product give: title, asin (the 10-character code, ONLY if you actually saw it in an amazon.in/dp/ address, otherwise empty string), price (approximate rupees as a number, or null), note (one short line, for example pack size).
Reply with ONLY a JSON array like [{"title":"...","asin":"","price":199,"note":"..."}]. Never invent an asin.`;
    const r: any = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const arr = parseJson(r?.text ?? '');
    if (!Array.isArray(arr)) return { ok: false, results: [], error: 'Gemini gave no usable answer.' };
    const out = arr.map(toCandidate).filter(Boolean) as GeminiCandidate[];
    out.sort((a, b) => (a.priceRupees ?? Infinity) - (b.priceRupees ?? Infinity));
    return { ok: out.length > 0, results: out.slice(0, 5), error: out.length ? undefined : 'Gemini found nothing.' };
  } catch (err: any) {
    console.error('[geminiProductService] find failed:', err?.message || err);
    return { ok: false, results: [], error: 'Gemini search failed.' };
  }
}

/** Try to read one product page. Returns null when Gemini could not read it. */
export async function geminiDescribeProduct(
  asin: string
): Promise<{ title: string; priceRupees: number | null; extractedUnit: string | null; description: string | null } | null> {
  const ai = client();
  if (!ai || !/^[A-Z0-9]{10}$/.test(asin)) return null;
  try {
    const url = 'https://www.amazon.in/dp/' + asin;
    const prompt = `Read this product page: ${url}
If you can read it, reply with ONLY a JSON object {"title":"...","price":number or null,"description":"one plain sentence for a parent, max 25 words"}.
If you cannot read it, reply with ONLY {"title":""}. Never guess.`;
    const r: any = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { tools: [{ urlContext: {} }, { googleSearch: {} }] },
    });
    const o = parseJson(r?.text ?? '');
    const title = String(o?.title || '').trim().slice(0, 160);
    if (!title) return null;
    const p = Number(String(o?.price ?? '').replace(/[^0-9.]/g, ''));
    return {
      title,
      priceRupees: Number.isFinite(p) && p > 0 && p < 500000 ? Math.round(p) : null,
      extractedUnit: unitFromTitle(title),
      description: o?.description ? String(o.description).slice(0, 200) : null,
    };
  } catch (err: any) {
    console.error('[geminiProductService] describe failed:', err?.message || err);
    return null;
  }
}
