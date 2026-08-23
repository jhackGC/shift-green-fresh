/**
 * Vendor-agnostic unit parsing/conversion. This is the reusable core every vendor adapter
 * feeds into — it knows nothing about xlsx, sheet layout, or any specific vendor.
 */

export type ParsedPackSize = { qty: number; unit: string; unparsed?: boolean };

/** Weight-based units that convert to kg directly, without needing a product's avgWeightG. */
const WEIGHT_UNITS = new Set(['KG', 'G']);

/**
 * Turns a vendor's raw pack-size text into a structured qty + unit.
 *
 * Handles:
 *  - "PER KG"            -> { qty: 1, unit: 'KG' }               (price is already $/kg)
 *  - "5KG", "8KG", "10KG" -> { qty: 5|8|10, unit: 'KG' }
 *  - "400G", "250G"       -> { qty: 400|250, unit: 'G' }
 *  - "1BN", "12BN", "1EA", "1PT", "1SLV", "1 PNT" -> { qty, unit } (count-based, needs avgWeightG)
 *  - "8X1KG"               -> { qty: 8, unit: 'KG' }               (8 packs of 1kg = 8kg total)
 *
 * Returns `unparsed: true` (with a best-effort qty/unit guess) when the text doesn't match any
 * known pattern, so the caller can still record *something* rather than crash, while flagging it
 * for review.
 */
export function parsePackSize(sizeText: string | null | undefined): ParsedPackSize {
  const text = (sizeText ?? '').trim().toUpperCase();

  if (text === 'PER KG') {
    return { qty: 1, unit: 'KG' };
  }

  // "8X1KG" style: count x unit-size
  const multiMatch = text.match(/^(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)\s*([A-Z]+)$/);
  if (multiMatch && multiMatch[1] && multiMatch[2] && multiMatch[3]) {
    const count = Number(multiMatch[1]);
    const unitSize = Number(multiMatch[2]);
    const unit = multiMatch[3];
    return { qty: count * unitSize, unit };
  }

  // "6-7KG", "12-13KG" style: a weight range — use the midpoint.
  const rangeMatch = text.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*([A-Z]+)$/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2] && rangeMatch[3]) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    return { qty: (low + high) / 2, unit: rangeMatch[3] };
  }

  // "5KG", "1BN", "1 PNT", "8KG", "1KG NET" style: qty + unit, tolerating a trailing word.
  const simpleMatch = text.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)(?:\s+[A-Z]+)?$/);
  if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
    return { qty: Number(simpleMatch[1]), unit: simpleMatch[2] };
  }

  // Fallback: pull out whatever number and letters we can find, flag as unparsed.
  const looseNumber = text.match(/\d+(?:\.\d+)?/);
  const looseUnit = text.match(/[A-Z]+/);
  return {
    qty: looseNumber ? Number(looseNumber[0]) : 1,
    unit: looseUnit ? looseUnit[0] : text || 'UNKNOWN',
    unparsed: true
  };
}

export type PricePerKgResult = { value: number | null; needsConversionFactor: boolean };

/**
 * Converts a vendor's raw pack price to $/kg.
 *  - KG/G-denominated packs convert directly from qty.
 *  - Count-based packs (EA, BN, PT, SLV, ...) need `avgWeightG` (the product's average weight
 *    per unit) to bridge to kg; when it's not known yet, returns `needsConversionFactor: true`
 *    and a null value instead of guessing.
 */
export function computePricePerKg(
  price: number,
  qty: number,
  unit: string,
  avgWeightG: number | null
): PricePerKgResult {
  if (qty <= 0 || !Number.isFinite(price)) {
    return { value: null, needsConversionFactor: false };
  }

  const normalizedUnit = unit.trim().toUpperCase();

  if (normalizedUnit === 'KG') {
    return { value: price / qty, needsConversionFactor: false };
  }

  if (normalizedUnit === 'G') {
    return { value: price / (qty / 1000), needsConversionFactor: false };
  }

  // Count-based unit (EA, BN, PT, SLV, ...) — need the product's average weight to bridge to kg.
  if (avgWeightG == null || avgWeightG <= 0) {
    return { value: null, needsConversionFactor: true };
  }

  const pricePerPackUnit = price / qty;
  const avgWeightKg = avgWeightG / 1000;
  return { value: pricePerPackUnit / avgWeightKg, needsConversionFactor: false };
}

/** Slug for use as an entity id: lowercase, non-alphanumerics collapsed to single hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Best-effort canonical product name from a raw sheet label. Vendor sheets often bake the pack
 * size straight into the product name (e.g. "APPLE PINK LADY 12KG" vs "APPLE PINK LADY 9KG" —
 * two pack sizes of the same product), so this strips a trailing size/pack chunk before title
 * casing, letting both collapse onto one Product.
 *
 * This is a heuristic, not a solver — near-duplicate product names are expected and are meant to
 * be merged by hand in products.json when spotted, not silently auto-merged.
 */
export function deriveProductName(rawProduct: string): string {
  let cleaned = rawProduct.trim();
  // "8X1KG" / "8 X 1KG" style trailing pack descriptor.
  cleaned = cleaned.replace(/\s+\d+(?:\.\d+)?\s*X\s*\d+(?:\.\d+)?\s*(?:KG|G)\s*$/i, '');
  // Plain trailing "12KG" / "400G" style pack descriptor.
  cleaned = cleaned.replace(/\s+\d+(?:\.\d+)?\s*(?:KG|G)\s*$/i, '');
  cleaned = cleaned.trim();

  return cleaned
    .split(/\s+/)
    .map((word) => (word.length ? word[0] + word.slice(1).toLowerCase() : word))
    .join(' ');
}
