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

import fs from 'fs';
import { GoogleGenAI, createUserContent } from '@google/genai';

const MODEL = 'gemini-3.5-flash';

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch {
    return null;
  }
}

/**
 * Turns a material name (and optional short description / photo) into a
 * concise Amazon-India search phrase. Falls back to the original name on
 * any failure — never throws, never blocks the PA API search that follows.
 */
export async function refineSearchQuery(
  materialName: string,
  description?: string | null,
  imageLocalPath?: string | null
): Promise<string> {
  const fallback = materialName.trim();
  const ai = getClient();
  if (!ai || !fallback) return fallback;

  try {
    const prompt = `You help find the right product on Amazon India for a children's STEAM-education materials catalog. Given a material name${description ? ' and description' : ''}, output ONLY the best short Amazon search phrase (3-6 words) to find that exact product — no explanation, no quotes, no punctuation besides spaces.

Material name: "${materialName}"
${description ? `Description: "${description}"` : ''}

Search phrase:`;

    const parts: any[] = [prompt];
    if (imageLocalPath && fs.existsSync(imageLocalPath)) {
      const bytes = fs.readFileSync(imageLocalPath);
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: bytes.toString('base64'),
        },
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createUserContent(parts),
    });

    const text = (response?.text ?? '').trim().replace(/^["']|["']$/g, '');
    return text.length > 0 && text.length < 120 ? text : fallback;
  } catch (err) {
    console.error('[materialSearchAssistService] refine failed, using raw name:', err);
    return fallback;
  }
}
