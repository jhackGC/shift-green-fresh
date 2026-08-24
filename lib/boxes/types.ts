/**
 * A "box" for the pickup-only pre-order trial: a curated mix of whatever's available on a given
 * week's wholesale list, priced as one bundle. Unlike the à-la-carte margin/pricing tools
 * elsewhere in this app, a box's contents are hand-composed week to week (whatever eco-farms has
 * fresh/cheap that week) — this is just the entity + cost math, not an auto-composer.
 */

export type BoxItem = {
  productId: string;
  /** kg for this item in one box. */
  qty: number;
  /**
   * Alternatives a customer may swap this item for, at the same kg — a small pool curated by
   * whoever built the box, not "anything on the wholesale list." Keeps procurement predictable
   * (every alternative was already priced this week when the box was saved) while still letting
   * someone who doesn't use parsley pick something they'll actually use. Omitted or empty means
   * this slot isn't swappable.
   */
  swapOptions?: string[];
};

export type Box = {
  id: string;
  name: string;
  /** Who/what this box is a starting point for, e.g. "Single person or couple, light week" or
   *  "Family of 4, full week of home cooking" — every box here is a template a customer (or you)
   *  adjusts item-by-item, not a fixed product; this is the guidance that points them at the
   *  right starting size before they tweak it. */
  description?: string;
  /** The wholesale import date this box's pricing was composed against — ties the box to a
   *  specific week's availability/cost snapshot, since both change week to week. */
  weekOf: string;
  vendorCode: string;
  items: BoxItem[];
  /** Target margin (%) used to derive the sell price when this box was saved. */
  marginPercent: number;
  /**
   * Cost per box at save time. If `boxCount` was given, this is the pack-rounding-aware cost
   * (real packs bought ÷ boxCount, cheaper of whole-packs-vs-split-fee per item) — otherwise it's
   * the naive cost assuming you can buy the exact kg needed at the cheapest $/kg, which tends to
   * undercount real procurement cost once pack sizes don't divide demand evenly.
   */
  wholesaleCost: number;
  /** How many boxes this cost was estimated against, when pack-rounding was used. */
  boxCount?: number;
  /** A market-researched RRP, if supplied — takes priority over the formula price when set. */
  researchedRrp?: number;
  /** researchedRrp if set, else round(priceForMargin(wholesaleCost, marginPercent)) to the
   *  nearest dollar. */
  sellPrice: number;
  createdAt: string;
};
