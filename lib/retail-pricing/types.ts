/**
 * Retail-side pricing entity — mirrors lib/vendor-pricing/types.ts's VendorPricing, joined to
 * the same shared Product catalog. A retailer's board is photographed, not structured data, so
 * (unlike the xlsx vendor adapter) the raw transcription is hand-authored — see
 * scripts/importers/merrimac.ts — while matching/normalization stays code, reusable by future
 * retailers.
 *
 * Storage model (see lib/retail-pricing/store.ts): each retailer has one mutable `current.json`
 * — the live prices the admin UI reads and edits — plus dated, append-only snapshots under
 * `imports/` recording exactly what each ingest run parsed, for audit purposes only. A re-ingest
 * never overwrites `current.json` directly: any row where the newly-parsed price differs from
 * the current one becomes a PendingRetailChange instead, requiring approval in the UI before it
 * takes effect. A row with no existing current value (a genuinely new board line) has nothing to
 * override, so it merges into `current.json` immediately.
 */

export type RetailPricing = {
  /** `${productId}__${retailerCode}__${slugify(rawLabel)}` — stable across re-ingests (same board
   *  line + same product = same identity over time), and deliberately keyed by rawLabel rather
   *  than fan-out position: two different board lines can each legitimately price the same
   *  product (e.g. "Mushrooms Loose" and "Mushrooms Punnets" both pricing every mushroom variety)
   *  and need distinct ids, not to collide into one. */
  id: string;
  /** -> Product.id. A single board line can produce several RetailPricing rows (one per
   *  matched product) when the retailer's label is generic — e.g. "Apples Loose" prices every
   *  apple variety we stock the same, since the board doesn't distinguish. */
  productId: string;
  /** e.g. 'merrimac' */
  retailerCode: string;
  /** ISO date this price was last confirmed — either the ingest that first set it, an approved
   *  pending change, or a manual edit in the UI. */
  date: string;
  /** Original board text, e.g. 'Apples Loose'. */
  rawLabel: string;
  price: number;
  qty: number;
  retailUnit: string;
  destinationUnit: 'kg';
  pricePerDestinationUnit: number | null;
  needsConversionFactor: boolean;
  /** 'ok' for an unambiguous 1:1 match; 'verify' when this row came from a generic label fanned
   *  out across multiple products (or the price itself was hard to read on the board). */
  confidence: 'ok' | 'verify';
  note: string;
};

/**
 * A price a re-ingest found for a product that already has a different current price — staged
 * for a human to approve or reject in the admin UI rather than applied automatically.
 */
export type PendingRetailChange = {
  /** Same value as the RetailPricing row it proposes to change — see RetailPricing.id. */
  id: string;
  productId: string;
  retailerCode: string;
  rawLabel: string;
  currentPrice: number;
  currentPricePerDestinationUnit: number | null;
  proposedPrice: number;
  proposedPricePerDestinationUnit: number | null;
  qty: number;
  retailUnit: string;
  /** The ingest date that proposed this change. */
  proposedDate: string;
  note: string;
};
