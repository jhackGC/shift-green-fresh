/**
 * Matches a retailer's generic board label ("Apples Loose", "Avocados Hass EA") against the
 * shared Product catalog, which is far more granular (11 apple varieties, 3 avocado grades, ...).
 *
 * The core rule: a board label is either genuinely generic (no variety named — "Apples Loose")
 * or it names a specific variety ("Avocados Hass"). Generic labels fan out across every
 * candidate product sharing the same stem (e.g. every 'apple-*' product) — repeating the same
 * price for every variety, as instructed. A named variety instead narrows to just the matching
 * candidate(s) — and, critically, if that variety isn't found among the wholesale candidates at
 * all (e.g. "Avocados Fuerte" when only Hass is stocked), it must NOT silently fall back to the
 * wrong variety. Unmatched is the correct, safe outcome there.
 *
 * A separate, looser rule applies to *grade* qualifiers (2nds, imperfect, juicing, processing,
 * pickling) — these describe quality/purpose, not a different product. A generic label excludes
 * graded wholesale candidates (comparing "Apples Loose" against juicing apples would be
 * misleading); but when no non-graded candidate exists for a labeled grade mismatch (retail says
 * "2nds", no wholesale 2nds SKU exists), it's fine to fall back to the standard candidates,
 * flagged for review rather than left unmatched — a grade mismatch is still a useful comparison,
 * just an approximate one.
 */
import type { Product } from '../vendor-pricing/types';

const GRADE_QUALIFIERS = new Set(['2nd', '2nds', 'imperfect', 'juicing', 'processing', 'pickling']);

const FILLER_WORDS = new Set([
  'loose',
  'kg',
  'ea',
  'each',
  'bags',
  'bag',
  'punnet',
  'punnets',
  'whole',
  'cut',
  'bunch',
  'bunches',
  'net',
  'mix',
  'grade',
  '1st',
  '2kg',
  '1kg',
  '3kg',
  '5kg',
  '250g',
  '500g'
]);

function slugWords(id: string): string[] {
  return id.split('-');
}

/**
 * Crude, deterministic singularization (strip a trailing 's') applied identically to both the
 * caller's stem and each candidate's first slug word before comparing. The product catalog is
 * inconsistently pluralized at the source (e.g. 'lemon' vs 'lemons-imperfect', 'mandarin-daisy'
 * vs 'mandarins-ellendale') — this doesn't need to be linguistically correct, just consistent on
 * both sides, so the two forms collapse onto the same stem instead of silently missing matches.
 */
function normalizeStem(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function normalizeLabelWords(rawLabel: string): string[] {
  return rawLabel
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export type MatchResult = {
  productIds: string[];
  /** true when this label matched >1 product (a generic fan-out) or a grade-mismatch fallback —
   *  either way, a judgment call worth a human glancing at, not a certainty. */
  ambiguous: boolean;
  note: string;
};

/**
 * `stem` is the product-family prefix to match against (e.g. 'apple', 'avocado', 'grapefruit') —
 * the first significant word of the board label, singularized by the caller (see merrimac.ts).
 */
export function matchProducts(products: Product[], rawLabel: string, stem: string): MatchResult {
  const normalizedStem = normalizeStem(stem);
  const candidates = products.filter(
    (p) => normalizeStem(slugWords(p.id)[0] ?? '') === normalizedStem
  );
  if (candidates.length === 0) {
    return {
      productIds: [],
      ambiguous: false,
      note: `No wholesale products found for stem "${stem}".`
    };
  }

  const labelWords = new Set(
    normalizeLabelWords(rawLabel).filter((w) => normalizeStem(w) !== normalizedStem)
  );

  const contentWords = [...labelWords].filter(
    (w) => !FILLER_WORDS.has(w) && !GRADE_QUALIFIERS.has(w)
  );
  const gradeWords = [...labelWords].filter((w) => GRADE_QUALIFIERS.has(w));

  if (contentWords.length > 0) {
    // A specific variety was named — narrow to candidates whose slug mentions it.
    const overlap = candidates.filter((p) =>
      slugWords(p.id)
        .slice(1)
        .some((w) => contentWords.includes(w))
    );
    if (overlap.length > 0) {
      return {
        productIds: overlap.map((p) => p.id),
        ambiguous: overlap.length > 1,
        note: `Matched on variety word(s): ${contentWords.join(', ')}.`
      };
    }
    // Named a variety we don't stock from this vendor — do not guess a different one.
    return {
      productIds: [],
      ambiguous: false,
      note: `Board names a variety ("${contentWords.join(', ')}") not found among wholesale "${stem}" products — left unmatched rather than guessing.`
    };
  }

  // Fully generic label — fan out across every candidate, excluding graded SKUs (juicing,
  // imperfect, ...) unless the board itself named that same grade.
  const nonGraded = candidates.filter(
    (p) =>
      !slugWords(p.id)
        .slice(1)
        .some((w) => GRADE_QUALIFIERS.has(w))
  );
  if (gradeWords.length > 0) {
    const gradeMatched = candidates.filter((p) =>
      slugWords(p.id)
        .slice(1)
        .some((w) => gradeWords.includes(w))
    );
    if (gradeMatched.length > 0) {
      return {
        productIds: gradeMatched.map((p) => p.id),
        ambiguous: gradeMatched.length > 1,
        note: `Matched on grade: ${gradeWords.join(', ')}.`
      };
    }
    // Board named a grade (e.g. "2nds") with no matching graded SKU — fall back to standard
    // candidates, flagged, since it's still a useful (if approximate) comparison.
    return {
      productIds: nonGraded.map((p) => p.id),
      ambiguous: true,
      note: `Board grade "${gradeWords.join(', ')}" has no matching wholesale SKU — compared against standard-grade products instead.`
    };
  }

  return {
    productIds: nonGraded.map((p) => p.id),
    ambiguous: nonGraded.length > 1,
    note:
      nonGraded.length > 1
        ? `Generic label — same price applied to all ${nonGraded.length} "${stem}" varieties we stock.`
        : ''
  };
}
