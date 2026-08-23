/**
 * Shelf-stable, non-produce items (honey, preserves, dried goods, eggs, oils, ...) — a different
 * supply chain from the weekly eco-farms produce list, so cost/price are entered by hand rather
 * than derived from an import. The point of tracking these separately from boxes: if fresh
 * produce is deliberately sold near/below wholesale cost as a customer-acquisition subsidy, these
 * are the items meant to fund that gap, and you need to see both sides on the same P&L to know
 * whether they actually do.
 */

export type NonPerishableItem = {
  id: string;
  name: string;
  category?: string;
  /** $ cost per unit, however you buy it (each, jar, box — up to you what a "unit" means). */
  cost: number;
  sellPrice: number;
  createdAt: string;
};
