/**
 * Common, vendor-agnostic entities for the produce pricing ingestion pipeline.
 *
 * A vendor's price list (e.g. an Eco-Farms xlsx) is imported into two things:
 *  - Product: a canonical catalog entry ("Pink Lady Apple", "Snow Peas"), shared across every vendor.
 *  - VendorPricing: one row per product per vendor per import date, carrying the vendor's raw
 *    pack price/qty/unit *and* that price normalized to a standard unit (kg) so it becomes
 *    comparable across vendors.
 */

export type Product = {
  /** Slug, e.g. 'pink-lady-apple', 'snow-peas'. */
  id: string;
  /** Canonical display name, e.g. 'Pink Lady Apple'. */
  name: string;
  category?: 'Fruit' | 'Vegetables';
  /**
   * Average weight (grams) of one "each"/"bunch"-style unit. Needed to convert non-weight-based
   * vendor packs (EA, BN, PT, SLV, ...) to kg. Null until known — set by hand once you have a
   * real figure, then re-run the importer (or re-run normalization) to fill in the price/kg.
   */
  avgWeightG: number | null;
};

export type VendorPricing = {
  /** `${productId}__${vendorCode}__${date}` */
  id: string;
  /** -> Product.id */
  productId: string;
  /** e.g. 'eco-farms' */
  vendorCode: string;
  /** ISO capture date, e.g. '2026-08-24'. */
  date: string;
  /** Original product text from the source sheet, kept for traceability back to the source row. */
  rawLabel: string;
  /** Vendor's raw price for the pack as listed. */
  price: number;
  /** Pack quantity, e.g. 10 for a "10KG" bag, 12 for "12BN" (12 bunches), 8 for "8X1KG". */
  qty: number;
  /** Vendor's raw pack unit, e.g. 'KG' | 'G' | 'EA' | 'BN' | 'PT' | 'SLV' | ... */
  vendorUnit: string;
  /** Standard unit everything compares on. Fixed to 'kg' for v1. */
  destinationUnit: 'kg';
  /**
   * price / qty when vendorUnit is weight-based directly (KG, G); computed via
   * Product.avgWeightG when vendorUnit is count-based (EA, BN, ...); null when the
   * conversion factor isn't known yet.
   */
  pricePerDestinationUnit: number | null;
  /** True when vendorUnit isn't weight-based and Product.avgWeightG is missing. */
  needsConversionFactor: boolean;
};
