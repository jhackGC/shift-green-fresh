/**
 * Retailer adapter: Fresh Organic Merrimac price board (photo) -> RetailPricing, matched against
 * the shared Product catalog (see lib/retail-pricing/match.ts for the matching rules).
 *
 * Unlike the eco-farms xlsx adapter, the source here is a photograph
 * (doc/fresh_organic_merrimac_retailer_pricing_1.jpeg), not structured data — so RAW_ROWS below
 * is a hand transcription (the manual/AI-vision step this pipeline always needed for a photo
 * source), cross-checked against the retail-side prices already verified in the very first pass
 * at this board (lib/margins/data.ts's PRODUCE_ROWS, dated 23 Aug 2026). Lines whose price wasn't
 * legibly certain are simply omitted rather than guessed — same discipline as the wholesale side.
 *
 * `stem` is the product-family prefix to match against (see lib/retail-pricing/match.ts).
 * `matchLabel` overrides what text feeds the matcher when the board's own wording doesn't line
 * up with how the wholesale catalog names things (e.g. "Lettuce Rocket Punnets" needs to match
 * against 'rocket-*' products, not 'lettuce-*') — `rawLabel` itself is always what's stored,
 * verbatim off the board.
 *
 * Usage: pnpm import:merrimac --date 2026-08-23 [--dry-run]
 *
 * Re-running this for a later date does NOT overwrite whatever's live in current.json. Each
 * parsed row is diffed against the current price for that product: no existing price -> merged
 * into current.json directly (nothing to override); same price -> no-op; a different price ->
 * staged as a PendingRetailChange for approval in the admin UI, current.json left untouched.
 * That's what protects manual corrections made through the UI from being silently clobbered by a
 * later re-ingest. The very first run for a retailer has nothing to diff against, so every row
 * lands in current.json directly — that's the baseline.
 */
import { computePricePerKg, parsePackSize, slugify } from '../../lib/vendor-pricing/normalize';
import { loadProducts } from '../../lib/vendor-pricing/store';
import type { Product } from '../../lib/vendor-pricing/types';
import { matchProducts } from '../../lib/retail-pricing/match';
import {
  importSnapshotExists,
  loadCurrentRetailPricing,
  loadPendingRetailChanges,
  saveCurrentRetailPricing,
  saveImportSnapshot,
  savePendingRetailChanges
} from '../../lib/retail-pricing/store';
import type { PendingRetailChange, RetailPricing } from '../../lib/retail-pricing/types';

const RETAILER_CODE = 'merrimac';

type RawRow = {
  rawLabel: string;
  stem: string;
  matchLabel?: string;
  size: string; // fed straight into parsePackSize, e.g. 'PER KG', '1KG', '250G', '1EA'
  price: number;
  note?: string;
};

const RAW_ROWS: RawRow[] = [
  // ---------- FRUIT ----------
  {
    rawLabel: 'Apples Loose',
    stem: 'apple',
    size: 'PER KG',
    price: 9.9,
    note: "Board's price column position for 'Apples Loose' vs 'Apples 2nds 2kg Bags' is ambiguous in the photo — verify against the source before trusting this figure."
  },
  { rawLabel: 'Avocados Fuerte', stem: 'avocado', size: '1EA', price: 11.9 },
  {
    rawLabel: 'Avocados Hass',
    stem: 'avocado',
    size: '1EA',
    price: 2.9,
    note: 'Board also offers 3-for-$8 (~$2.67ea) — using the single-unit price.'
  },
  { rawLabel: 'Black Sapote', stem: 'sapote', matchLabel: 'Sapote', size: '1EA', price: 3.5 },
  { rawLabel: 'Grapefruit Loose', stem: 'grapefruit', size: 'PER KG', price: 6.9 },
  { rawLabel: 'Grapefruit 2nds 2kg Bags', stem: 'grapefruit', size: '2KG', price: 5.9 },
  { rawLabel: 'Kiwifruit', stem: 'kiwifruit', size: 'PER KG', price: 4.9 },
  { rawLabel: 'Lemonades', stem: 'lemonades', size: 'PER KG', price: 19.9 },
  {
    rawLabel: 'Lemons 1st Grade',
    stem: 'lemon',
    size: 'PER KG',
    price: 6.9,
    note: 'Price/column alignment around the 1st/2nd grade lemon rows is hand-corrected on the board — verify against the source.'
  },
  { rawLabel: 'Limes', stem: 'lime', size: 'PER KG', price: 29.9 },
  {
    rawLabel: 'Mandarins Daisy',
    stem: 'mandarin',
    matchLabel: 'Mandarin Daisy',
    size: 'PER KG',
    price: 9.9
  },
  {
    rawLabel: 'Mandarins Imperial',
    stem: 'mandarin',
    matchLabel: 'Mandarin Imperial',
    size: 'PER KG',
    price: 12.9
  },
  { rawLabel: 'Oranges', stem: 'orange', size: 'PER KG', price: 7.9 },
  { rawLabel: 'Passionfruit', stem: 'passionfruit', size: 'PER KG', price: 19.9 },
  { rawLabel: 'Paw Paw', stem: 'papaya', matchLabel: 'Papaya', size: 'PER KG', price: 9.9 },
  { rawLabel: 'Pears', stem: 'pear', size: 'PER KG', price: 9.9 },
  { rawLabel: 'Strawberries 250g', stem: 'strawberries', size: '250G', price: 8.9 },
  {
    rawLabel: 'Strawberries 500g 2nds',
    stem: 'strawberries',
    size: '500G',
    price: 8.9,
    note: 'Same price as the 250g line on the board — worth double-checking against the source, an 500g-2nds punnet priced identically to a 250g punnet is unusual.'
  },
  { rawLabel: 'Tangelos', stem: 'tangelo', size: 'PER KG', price: 9.9 },
  { rawLabel: 'Watermelon', stem: 'watermelon', size: 'PER KG', price: 5.9 },

  // ---------- VEGETABLES ----------
  { rawLabel: 'Beetroot Loose', stem: 'beetroot', size: 'PER KG', price: 19.9 },
  { rawLabel: 'Beetroot 1kg Bags', stem: 'beetroot', size: '1KG', price: 5.9 },
  { rawLabel: 'Broccoli', stem: 'broccoli', size: 'PER KG', price: 4.9 },
  { rawLabel: 'Cabbages', stem: 'cabbage', size: '1EA', price: 6.9 },
  { rawLabel: 'Capsicum Green', stem: 'capsicum', size: 'PER KG', price: 7.9 },
  { rawLabel: 'Capsicum Red', stem: 'capsicum', size: 'PER KG', price: 16.9 },
  { rawLabel: 'Carrots Loose', stem: 'carrot', size: 'PER KG', price: 24.9 },
  { rawLabel: 'Carrots 1kg Bags', stem: 'carrot', size: '1KG', price: 6.9 },
  { rawLabel: 'Carrots 2nds 2kg Bags', stem: 'carrot', size: '2KG', price: 6.5 },
  { rawLabel: 'Carrots 2nds 5kg Bags', stem: 'carrot', size: '5KG', price: 11.9 },
  { rawLabel: 'Cauliflower', stem: 'cauliflower', size: '1EA', price: 7.9 },
  { rawLabel: 'Celery', stem: 'celery', size: '1EA', price: 7.9 },
  { rawLabel: 'Chillies', stem: 'chilli', matchLabel: 'Chilli', size: '1EA', price: 1.5 },
  { rawLabel: 'Corn', stem: 'corn', size: '1EA', price: 3.5 },
  { rawLabel: 'Cucumber', stem: 'cucumber', size: 'PER KG', price: 11.9 },
  { rawLabel: 'Eggplant', stem: 'eggplant', size: 'PER KG', price: 9.9 },
  { rawLabel: 'Garlic', stem: 'garlic', size: 'PER KG', price: 79.9 },
  { rawLabel: 'Ginger', stem: 'ginger', size: 'PER KG', price: 29.9 },
  { rawLabel: 'Leeks', stem: 'leek', size: '1EA', price: 3.9 },
  {
    rawLabel: 'Lettuce Mix Punnets',
    stem: 'lettuce',
    matchLabel: 'Lettuce Salad Mix Punnet',
    size: '1EA',
    price: 5.9
  },
  {
    rawLabel: 'Lettuce Rocket Punnets',
    stem: 'rocket',
    matchLabel: 'Rocket Punnet',
    size: '1EA',
    price: 5.9
  },
  {
    rawLabel: 'Mushrooms Loose',
    stem: 'mushroom',
    matchLabel: 'Mushrooms',
    size: 'PER KG',
    price: 39.9
  },
  {
    rawLabel: 'Mushrooms Punnets',
    stem: 'mushroom',
    matchLabel: 'Mushrooms',
    size: '1EA',
    price: 7.9
  },
  { rawLabel: 'Parsnip', stem: 'parsnip', size: 'PER KG', price: 14.9 },
  {
    rawLabel: 'Peas Sugar Snap',
    stem: 'peas',
    matchLabel: 'Sugarsnap',
    size: 'PER KG',
    price: 3.5
  },
  {
    rawLabel: 'Pumpkin Butternut Cut',
    stem: 'pumpkin',
    matchLabel: 'Pumpkin Butternut',
    size: 'PER KG',
    price: 3.2
  },
  {
    rawLabel: 'Pumpkin Butternut Whole',
    stem: 'pumpkin',
    matchLabel: 'Pumpkin Butternut',
    size: 'PER KG',
    price: 2.9
  },
  {
    rawLabel: 'Pumpkin Jap Cut',
    stem: 'pumpkin',
    matchLabel: 'Pumpkin Jap',
    size: 'PER KG',
    price: 2.5
  },
  {
    rawLabel: 'Pumpkin Jap Whole',
    stem: 'pumpkin',
    matchLabel: 'Pumpkin Jap',
    size: 'PER KG',
    price: 6.5
  },
  {
    rawLabel: 'Spinach Baby Loose',
    stem: 'spinach',
    matchLabel: 'Spinach Baby',
    size: 'PER KG',
    price: 5.9
  },
  {
    rawLabel: 'Spinach Baby Punnets',
    stem: 'spinach',
    matchLabel: 'Spinach Baby Punnet',
    size: '1EA',
    price: 9.9
  },
  { rawLabel: 'Squash', stem: 'squash', size: 'PER KG', price: 5.9 },
  {
    rawLabel: 'Superfood Mix Punnets',
    stem: 'superfood',
    matchLabel: 'Superfood Mix Punnet',
    size: '1EA',
    price: 4.9
  },
  { rawLabel: 'Thyme', stem: 'herbs', matchLabel: 'Herbs Thyme', size: 'PER KG', price: 19.9 },
  {
    rawLabel: 'Tomatoes Cherry Loose',
    stem: 'tomato',
    matchLabel: 'Tomato Cherry',
    size: 'PER KG',
    price: 5.9
  },
  {
    rawLabel: 'Tomatoes Cherry Punnets',
    stem: 'tomato',
    matchLabel: 'Tomato Cherry',
    size: '1EA',
    price: 7.9
  },
  {
    rawLabel: 'Tomatoes Roma Loose',
    stem: 'tomato',
    matchLabel: 'Tomato Roma',
    size: 'PER KG',
    price: 7.9
  },
  {
    rawLabel: 'Tomatoes Round Loose',
    stem: 'tomato',
    matchLabel: 'Tomato Gourmet',
    size: 'PER KG',
    price: 7.9,
    note: "Board's 'Round' tomatoes are the wholesale 'Gourmet' round-truss tomato — no product literally named 'round' exists, matched by hand."
  },
  { rawLabel: 'Turmeric', stem: 'turmeric', size: 'PER KG', price: 7.9 },
  {
    rawLabel: 'Zucchini Green',
    stem: 'zucchini',
    matchLabel: 'Zucchini',
    size: 'PER KG',
    price: 11.9,
    note: "Wholesale's bare 'Zucchini' has no green/gold/Lebanese qualifier of its own — assumed to be the standard (green) one, but the fan-out here also includes zucchini-lebanese since nothing distinguishes it as a different variety in the catalog."
  }
];

function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const date = get('--date');
  const dryRun = args.includes('--dry-run');
  if (!date) {
    console.error('Usage: import:merrimac --date <YYYY-MM-DD> [--dry-run]');
    process.exit(1);
  }

  if (!dryRun && importSnapshotExists(RETAILER_CODE, date)) {
    console.error(
      `data/retail-pricing/${RETAILER_CODE}/imports/${date}.json already exists — refusing to overwrite. Pick a different --date.`
    );
    process.exit(1);
  }

  const products = loadProducts();
  const productById = new Map<string, Product>(products.map((p) => [p.id, p]));

  const rows: RetailPricing[] = [];
  let matchedRows = 0;
  let unmatchedRows: string[] = [];
  let ambiguousRows = 0;
  let priced = 0;
  let needsConversion = 0;

  for (const raw of RAW_ROWS) {
    const match = matchProducts(products, raw.matchLabel ?? raw.rawLabel, raw.stem);
    if (match.productIds.length === 0) {
      unmatchedRows.push(`${raw.rawLabel} (${match.note})`);
      continue;
    }
    matchedRows++;
    if (match.ambiguous) ambiguousRows++;

    const parsed = parsePackSize(raw.size);

    match.productIds.forEach((productId) => {
      const product = productById.get(productId);
      const conversion = computePricePerKg(
        raw.price,
        parsed.qty,
        parsed.unit,
        product?.avgWeightG ?? null
      );
      if (conversion.needsConversionFactor) needsConversion++;
      else priced++;

      const noteParts = [raw.note, match.note].filter(Boolean);
      rows.push({
        id: `${productId}__${RETAILER_CODE}__${slugify(raw.rawLabel)}`,
        productId,
        retailerCode: RETAILER_CODE,
        date,
        rawLabel: raw.rawLabel,
        price: raw.price,
        qty: parsed.qty,
        retailUnit: parsed.unit,
        destinationUnit: 'kg',
        pricePerDestinationUnit: conversion.value,
        needsConversionFactor: conversion.needsConversionFactor,
        confidence: match.ambiguous || raw.note ? 'verify' : 'ok',
        note: noteParts.join(' ')
      });
    });
  }

  console.log(`Board lines transcribed: ${RAW_ROWS.length}`);
  console.log(
    `  Matched: ${matchedRows} (${ambiguousRows} generic/fan-out or grade-fallback, flagged 'verify')`
  );
  console.log(`  Unmatched: ${unmatchedRows.length}`);
  unmatchedRows.forEach((u) => console.log(`    - ${u}`));
  console.log(`Total RetailPricing rows produced: ${rows.length}`);
  console.log(`  Priced directly ($/kg known): ${priced}`);
  console.log(`  Needs a conversion factor (no avgWeightG yet): ${needsConversion}`);

  // Diff against whatever's currently live, rather than overwriting it: no existing price for
  // this row -> nothing to override, merge straight in; same price -> no-op; different price ->
  // stage for approval instead of applying it.
  const current = loadCurrentRetailPricing(RETAILER_CODE);
  const currentById = new Map(current.map((r) => [r.id, r]));
  const nextCurrent = [...current];
  // Preserve any still-unresolved pending change this run doesn't touch; a fresh proposal for the
  // same row (below) supersedes an older unresolved one rather than piling up duplicates.
  const previouslyPending = loadPendingRetailChanges(RETAILER_CODE);
  const touchedIds = new Set(rows.map((r) => r.id));
  const pendingChanges: PendingRetailChange[] = previouslyPending.filter(
    (p) => !touchedIds.has(p.id)
  );
  let addedNew = 0;
  let unchanged = 0;

  for (const row of rows) {
    const existing = currentById.get(row.id);
    if (!existing) {
      nextCurrent.push(row);
      addedNew++;
    } else if (existing.price === row.price) {
      unchanged++;
    } else {
      pendingChanges.push({
        id: row.id,
        productId: row.productId,
        retailerCode: RETAILER_CODE,
        rawLabel: row.rawLabel,
        currentPrice: existing.price,
        currentPricePerDestinationUnit: existing.pricePerDestinationUnit,
        proposedPrice: row.price,
        proposedPricePerDestinationUnit: row.pricePerDestinationUnit,
        qty: row.qty,
        retailUnit: row.retailUnit,
        proposedDate: date,
        note: `Re-ingest on ${date} found a different price for "${row.rawLabel}" than what's currently live — approve to apply it, reject to keep the current value.`
      });
    }
  }

  console.log(
    current.length === 0
      ? `\nNo existing current.json for ${RETAILER_CODE} — this is the baseline: all ${addedNew} rows become current.`
      : `\nDiff vs current: ${addedNew} new, ${unchanged} unchanged, ${pendingChanges.length} proposed change(s) awaiting approval.`
  );

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  saveImportSnapshot(RETAILER_CODE, date, rows);
  saveCurrentRetailPricing(RETAILER_CODE, nextCurrent);
  savePendingRetailChanges(RETAILER_CODE, pendingChanges);
  console.log(
    `\nWrote data/retail-pricing/${RETAILER_CODE}/imports/${date}.json, current.json, and pending.json` +
      (pendingChanges.length ? ` — review pending changes at /admin/retail-pricing.` : '.')
  );
}

main();
