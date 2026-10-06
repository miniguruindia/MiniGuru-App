// backend/src/utils/goinsPricing.ts
// The agreed automatic Goins rule (Oct 2026), shared by every place that can
// change a material's price or pack size:
//   Goins = round( priceEstimate / piecesInPack * SCALE ), then kept between
//   MIN and MAX. Pack size is read only from clear units; anything unclear
//   returns null, meaning "do not change the Goins value".

export const GOINS_SCALE = 0.1; // 1 Goin = Rs 10
export const GOINS_MIN = 5;
export const GOINS_MAX = 300;

export function packQty(unitRaw: string | null | undefined): number | null {
  const u = (unitRaw || 'piece').trim().toLowerCase();
  if (u === '' || u === 'piece' || u === 'pc' || u === 'unit' || u === 'each') return 1;
  const patterns: RegExp[] = [
    /\bpack of (\d+)\b/,
    /\bset of (\d+)\b/,
    /\b(\d+)\s*(?:pcs|pieces|pc)\b/,
    /\b(\d+)\s*count\b/,
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      return n > 0 ? n : null;
    }
  }
  return null;
}

export function autoGoinsFor(
  priceEstimate: number | null | undefined,
  unit: string | null | undefined
): number | null {
  if (!(typeof priceEstimate === 'number' && priceEstimate > 0)) return null;
  const q = packQty(unit);
  if (q === null) return null;
  const raw = Math.round((priceEstimate / q) * GOINS_SCALE);
  return Math.min(GOINS_MAX, Math.max(GOINS_MIN, raw));
}
