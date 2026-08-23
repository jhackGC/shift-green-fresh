/**
 * Real wholesale packs come in fixed sizes (a "15kg box"), but box demand is whatever kg total
 * your customers' orders add up to — the two rarely match exactly. This is the pack-rounding
 * math: given how much of a product you actually need, compare buying whole packs (cheap, but
 * you eat the surplus) against eco-farms' own "split box" option (a 20% handling fee — from the
 * source xlsx's own disclaimer, not a guess — applied to a partial pack so you buy closer to
 * exact need with no surplus).
 *
 * Simplification: this picks the single cheapest-$/kg pack size and evaluates both strategies
 * against it, rather than solving general bin-packing across mixed pack sizes — the right call
 * for a trial-scale tool, not worth the complexity otherwise.
 */

export type PackOption = { qty: number; price: number };

export type ProcurementPlan = {
  strategy: 'whole-packs' | 'split';
  packQty: number;
  packPrice: number;
  packsBought: number;
  /** Only set for the split strategy — the extra fractional kg bought via a split pack. */
  splitKg?: number;
  totalCost: number;
  boughtKg: number;
  surplusKg: number;
};

export const SPLIT_BOX_HANDLING_FEE = 0.2;

export function planProcurement(
  demandKg: number,
  packOptions: PackOption[]
): { wholePacks: ProcurementPlan; split: ProcurementPlan | null } | null {
  const valid = packOptions.filter((p) => p.qty > 0 && p.price > 0);
  if (demandKg <= 0 || valid.length === 0) return null;

  const cheapest = [...valid].sort((a, b) => a.price / a.qty - b.price / b.qty)[0]!;
  const pricePerKg = cheapest.price / cheapest.qty;

  const packsNeeded = Math.ceil(demandKg / cheapest.qty);
  const wholeBoughtKg = packsNeeded * cheapest.qty;
  const wholePacks: ProcurementPlan = {
    strategy: 'whole-packs',
    packQty: cheapest.qty,
    packPrice: cheapest.price,
    packsBought: packsNeeded,
    totalCost: packsNeeded * cheapest.price,
    boughtKg: wholeBoughtKg,
    surplusKg: wholeBoughtKg - demandKg
  };

  const fullPacks = Math.floor(demandKg / cheapest.qty);
  const remainderKg = demandKg - fullPacks * cheapest.qty;
  let split: ProcurementPlan | null = null;
  if (remainderKg > 0.001 && fullPacks < packsNeeded) {
    const splitCost = fullPacks * cheapest.price + remainderKg * pricePerKg * (1 + SPLIT_BOX_HANDLING_FEE);
    split = {
      strategy: 'split',
      packQty: cheapest.qty,
      packPrice: cheapest.price,
      packsBought: fullPacks,
      splitKg: remainderKg,
      totalCost: splitCost,
      boughtKg: fullPacks * cheapest.qty + remainderKg,
      surplusKg: 0
    };
  }

  return { wholePacks, split };
}

/** The cheaper of the two strategies (split only exists when there's a remainder to split). */
export function betterProcurement(plan: { wholePacks: ProcurementPlan; split: ProcurementPlan | null }): ProcurementPlan {
  if (!plan.split) return plan.wholePacks;
  return plan.split.totalCost < plan.wholePacks.totalCost ? plan.split : plan.wholePacks;
}
