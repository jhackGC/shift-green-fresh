/**
 * Retail-side pricing entity — mirrors lib/vendor-pricing/types.ts's VendorPricing, joined to
 * the same shared Product catalog. A retailer's board is photographed, not structured data, so
 * (unlike the xlsx vendor adapter) the raw transcription is hand-authored — see
 * scripts/importers/merrimac.ts — while matching/normalization stays code, reusable by future
 * retailers.
 */

export type RetailPricing = {
  /** `${productId}__${retailerCode}__${date}__${suffix}` */
  id: string;
  /** -> Product.id. A single board line can produce several RetailPricing rows (one per
   *  matched product) when the retailer's label is generic — e.g. "Apples Loose" prices every
   *  apple variety we stock the same, since the board doesn't distinguish. */
  productId: string;
  /** e.g. 'merrimac' */
  retailerCode: string;
  /** ISO capture date, e.g. '2026-08-23'. */
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
