import { priceForMargin } from '../margins/calc';
import type { Box } from '../boxes/types';
import type { NonPerishableItem } from '../non-perishables/types';
import type { BoxMixEntry, BusinessAssumptions, NonPerishableMixEntry } from './types';

export type BoxMixLine = {
  boxId: string;
  boxName: string;
  boxesPerWeek: number;
  costPerBox: number;
  sellPerBox: number;
  weeklyRevenue: number;
  weeklyCogs: number;
};

export type NonPerishableMixLine = {
  itemId: string;
  itemName: string;
  unitsPerWeek: number;
  costPerUnit: number;
  sellPerUnit: number;
  weeklyRevenue: number;
  weeklyCogs: number;
};

export type BusinessModelResult = {
  lines: BoxMixLine[];
  totalBoxesPerWeek: number;
  /** Produce only — see nonPerishable* fields for the other side of the P&L. */
  weeklyRevenue: number;
  weeklyCogs: number;
  /** revenue - cogs, before logistics/labour/fixed costs. */
  grossProfit: number;
  nonPerishableLines: NonPerishableMixLine[];
  nonPerishableRevenue: number;
  nonPerishableCogs: number;
  /** nonPerishableRevenue - nonPerishableCogs — the pool available to subsidize produce sold
   *  below its own cost, if that's the strategy. */
  nonPerishableProfit: number;
  logisticsCost: number;
  drivingLabourCost: number;
  packingLabourCost: number;
  weeklyFixedCosts: number;
  totalWeeklyCosts: number;
  netProfit: number;
  /** Weighted-average (revenue - cogs - packing cost) per box across the current mix — null with
   *  no boxes sold. */
  avgContributionMarginPerBox: number | null;
  /** (logistics + driving labour + fixed costs) ÷ avgContributionMarginPerBox — the volume, at
   *  the current mix ratio, where net profit hits zero. Null if the mix can't reach break-even
   *  (contribution margin per box is zero or negative — costs exceed revenue no matter the
   *  volume) or there's no mix to scale from yet. */
  breakEvenBoxesPerWeek: number | null;
  /** Total kg across the current box mix for one week's run — the number that actually sizes the
   *  vehicle (ute vs van vs truck), not box count, since box weights vary a lot. */
  totalWeeklyKg: number;
  /** Hours/week — zero in delivery mode, since nobody drives. */
  drivingHours: number;
  packingHours: number;
  totalLabourHours: number;
};

/** Total kg in one box, from its item list — same figure shown on /admin/boxes. */
export function boxWeightKg(box: Box): number {
  return box.items.reduce((sum, item) => sum + item.qty, 0);
}

/** eco-farms' real pick-up rate card: a flat small-order handling fee on orders under $400 — no
 *  fuel levy, unlike delivery (the levy is specifically for eco-farms' own delivery run, not
 *  something they charge when you collect it yourself). Real published rate, not an assumption. */
export const PICKUP_SMALL_ORDER_THRESHOLD = 400;
export const PICKUP_SMALL_ORDER_FEE = 25;

export function pickupSmallOrderFee(orderValue: number): number {
  return orderValue < PICKUP_SMALL_ORDER_THRESHOLD ? PICKUP_SMALL_ORDER_FEE : 0;
}

/**
 * Own-vehicle cost per trip, two ways: transport-only (fuel + vehicle cost + eco-farms' small-order
 * fee — what the "Transport" comparison card used to show, in isolation) and fully-loaded with
 * driving labour included. The fair comparison against a delivery fee is the fully-loaded figure —
 * delivery has no labour equivalent, so comparing it to transport-only understates what picking up
 * actually costs.
 *
 * `orderValue` is the produce wholesale cost being collected that trip — same basis eco-farms uses
 * for its delivery tiers, just a flat $25 rather than a tiered fee, and with no fuel levy added.
 */
export function computeOwnVehicleCostPerTrip(
  a: BusinessAssumptions,
  orderValue: number
): {
  transportOnly: number;
  withLabour: number;
  smallOrderFee: number;
} {
  const smallOrderFee = pickupSmallOrderFee(orderValue);
  const transportOnly = computeFuelCostPerTrip(a) + a.vehicleCostPerTrip + smallOrderFee;
  return {
    transportOnly,
    withLabour: transportOnly + a.drivingHoursPerTrip * a.hourlyLabourRate,
    smallOrderFee
  };
}

/** Round-trip fuel cost from distance × consumption × price — not entered directly, since those
 *  three are what's actually known/verifiable, not an assumed dollar figure. */
export function computeFuelCostPerTrip(a: BusinessAssumptions): number {
  const roundTripKm = a.distanceKmOneWay * 2;
  return (roundTripKm / 100) * a.fuelConsumptionL100km * a.fuelPricePerLitre;
}

/** eco-farms' real delivery rate card — tiered by order value, plus a flat fuel levy on every
 *  delivery regardless of tier. Real published rates, not an assumption to tune. */
export const DELIVERY_FUEL_LEVY = 29.75;

export function deliveryTierFee(orderValue: number): number {
  if (orderValue < 400) return 85;
  if (orderValue <= 1000) return 55;
  if (orderValue <= 1600) return 35;
  return 20;
}

export function computeTieredDeliveryFee(orderValue: number): {
  tierFee: number;
  fuelLevy: number;
  total: number;
} {
  const tierFee = deliveryTierFee(orderValue);
  return { tierFee, fuelLevy: DELIVERY_FUEL_LEVY, total: tierFee + DELIVERY_FUEL_LEVY };
}

/**
 * Logistics cost is trip-based, not per-box — one truck (or one delivery) covers however many
 * boxes it's carrying, up to whatever capacity really exists (not modelled here). That's why it
 * sits in the "fixed" side of the break-even math rather than scaling with box count.
 *
 * `orderValue` is the produce wholesale cost being delivered that trip — eco-farms' delivery fee
 * tier is based on what you're ordering, not a flat rate, so it has to be computed from the
 * actual box mix rather than entered as a standalone assumption.
 */
export function computeLogisticsCost(
  a: BusinessAssumptions,
  orderValue: number
): {
  logisticsCost: number;
  drivingLabourCost: number;
} {
  if (a.logisticsMode === 'own-vehicle') {
    return {
      logisticsCost:
        (computeFuelCostPerTrip(a) + a.vehicleCostPerTrip + pickupSmallOrderFee(orderValue)) *
        a.tripsPerWeek,
      drivingLabourCost: a.drivingHoursPerTrip * a.tripsPerWeek * a.hourlyLabourRate
    };
  }
  return {
    logisticsCost: computeTieredDeliveryFee(orderValue).total * a.tripsPerWeek,
    drivingLabourCost: 0
  };
}

export function computeBusinessModel(
  boxes: Box[],
  boxMix: BoxMixEntry[],
  nonPerishables: NonPerishableItem[],
  nonPerishableMix: NonPerishableMixEntry[],
  a: BusinessAssumptions
): BusinessModelResult {
  const boxById = new Map(boxes.map((b) => [b.id, b]));

  const lines: BoxMixLine[] = boxMix
    .filter((m) => m.boxesPerWeek > 0)
    .map((m) => {
      const box = boxById.get(m.boxId);
      const costPerBox = box?.wholesaleCost ?? 0;
      // A researched RRP is a deliberate, fixed price — respect it. Otherwise sell price tracks a
      // margin: this box's own override if the mix sets one (that's how a price ladder gets
      // modelled), else the model's global margin. Either way it's the live assumption, not
      // whatever margin the box happened to be saved with, so margins stay scenario-testable
      // without re-saving every box.
      const sellPerBox =
        box?.researchedRrp ??
        Math.round(priceForMargin(costPerBox, m.marginPercent ?? a.marginPercent));
      return {
        boxId: m.boxId,
        boxName: box?.name ?? m.boxId,
        boxesPerWeek: m.boxesPerWeek,
        costPerBox,
        sellPerBox,
        weeklyRevenue: sellPerBox * m.boxesPerWeek,
        weeklyCogs: costPerBox * m.boxesPerWeek
      };
    });

  const nonPerishableById = new Map(nonPerishables.map((i) => [i.id, i]));
  const nonPerishableLines: NonPerishableMixLine[] = nonPerishableMix
    .filter((m) => m.unitsPerWeek > 0)
    .map((m) => {
      const item = nonPerishableById.get(m.itemId);
      const costPerUnit = item?.cost ?? 0;
      const sellPerUnit = item?.sellPrice ?? 0;
      return {
        itemId: m.itemId,
        itemName: item?.name ?? m.itemId,
        unitsPerWeek: m.unitsPerWeek,
        costPerUnit,
        sellPerUnit,
        weeklyRevenue: sellPerUnit * m.unitsPerWeek,
        weeklyCogs: costPerUnit * m.unitsPerWeek
      };
    });
  const nonPerishableRevenue = nonPerishableLines.reduce((s, l) => s + l.weeklyRevenue, 0);
  const nonPerishableCogs = nonPerishableLines.reduce((s, l) => s + l.weeklyCogs, 0);
  const nonPerishableProfit = nonPerishableRevenue - nonPerishableCogs;

  const totalWeeklyKg = boxMix
    .filter((m) => m.boxesPerWeek > 0)
    .reduce((sum, m) => {
      const box = boxById.get(m.boxId);
      return sum + (box ? boxWeightKg(box) : 0) * m.boxesPerWeek;
    }, 0);

  const totalBoxesPerWeek = lines.reduce((s, l) => s + l.boxesPerWeek, 0);
  const weeklyRevenue = lines.reduce((s, l) => s + l.weeklyRevenue, 0);
  const weeklyCogs = lines.reduce((s, l) => s + l.weeklyCogs, 0);
  const grossProfit = weeklyRevenue - weeklyCogs;

  const { logisticsCost, drivingLabourCost } = computeLogisticsCost(a, weeklyCogs);
  const packingHours = totalBoxesPerWeek * (a.packingMinutesPerBox / 60);
  const packingLabourCost = packingHours * a.hourlyLabourRate;
  const drivingHours =
    a.logisticsMode === 'own-vehicle' ? a.drivingHoursPerTrip * a.tripsPerWeek : 0;
  const totalLabourHours = drivingHours + packingHours;
  const weeklyFixedCosts = a.weeklyFixedCosts;

  const totalWeeklyCosts =
    weeklyCogs +
    nonPerishableCogs +
    logisticsCost +
    drivingLabourCost +
    packingLabourCost +
    weeklyFixedCosts;
  const netProfit = weeklyRevenue + nonPerishableRevenue - totalWeeklyCosts;

  const packingCostPerBox = (a.packingMinutesPerBox / 60) * a.hourlyLabourRate;
  let avgContributionMarginPerBox: number | null = null;
  let breakEvenBoxesPerWeek: number | null = null;
  if (totalBoxesPerWeek > 0) {
    avgContributionMarginPerBox =
      weeklyRevenue / totalBoxesPerWeek - weeklyCogs / totalBoxesPerWeek - packingCostPerBox;
    const fixedWeekly = logisticsCost + drivingLabourCost + weeklyFixedCosts;
    if (avgContributionMarginPerBox > 0) {
      breakEvenBoxesPerWeek = fixedWeekly / avgContributionMarginPerBox;
    }
  }

  return {
    lines,
    totalBoxesPerWeek,
    weeklyRevenue,
    weeklyCogs,
    grossProfit,
    nonPerishableLines,
    nonPerishableRevenue,
    nonPerishableCogs,
    nonPerishableProfit,
    logisticsCost,
    drivingLabourCost,
    packingLabourCost,
    weeklyFixedCosts,
    totalWeeklyCosts,
    netProfit,
    avgContributionMarginPerBox,
    breakEvenBoxesPerWeek,
    totalWeeklyKg,
    drivingHours,
    packingHours,
    totalLabourHours
  };
}

export type LabourScenario = {
  label: string;
  selfDrives: boolean;
  selfPacks: boolean;
  /** Cash cost in this scenario — $0 when you do it yourself (an opportunity cost on your time,
   *  not a cash outflow), the modelled labour cost when it's paid out instead. */
  drivingCost: number;
  packingCost: number;
  totalLabourCost: number;
  netProfit: number;
  /**
   * Break-even boxes/week for THIS scenario specifically, at the current mix ratio — different
   * scenarios have genuinely different break-even points, since self-performed labour isn't a
   * cash cost dragging down the per-box contribution margin. "Break-even at 8 boxes" is only true
   * for whichever scenario you're actually in; the paid-labour scenarios need more volume to
   * reach the same cash outcome. Null if this scenario's margin per box is zero/negative — no
   * volume reaches break-even.
   */
  breakEvenBoxesPerWeek: number | null;
};

/**
 * Four staffing scenarios for the same box mix — driving and packing done yourself (no cash
 * cost, just your time) vs paid out (a real weekly expense at the modelled labour rate), all four
 * combinations. In delivery mode drivingLabourCost is already zero (nobody drives), so the
 * "self-drives" toggle collapses to no difference there — that's expected, not a bug.
 */
export function computeLabourScenarios(
  result: BusinessModelResult,
  a: BusinessAssumptions
): LabourScenario[] {
  const base =
    result.weeklyRevenue +
    result.nonPerishableProfit -
    result.weeklyCogs -
    result.logisticsCost -
    result.weeklyFixedCosts;
  const packingCostPerBox = (a.packingMinutesPerBox / 60) * a.hourlyLabourRate;
  const avgSellPerBox =
    result.totalBoxesPerWeek > 0 ? result.weeklyRevenue / result.totalBoxesPerWeek : 0;
  const avgCostPerBox =
    result.totalBoxesPerWeek > 0 ? result.weeklyCogs / result.totalBoxesPerWeek : 0;

  return (
    [
      { label: 'You do both (driving + packing)', selfDrives: true, selfPacks: true },
      { label: 'You drive, pay for packing', selfDrives: true, selfPacks: false },
      { label: 'You pack, pay for driving', selfDrives: false, selfPacks: true },
      { label: 'You do neither (pay for both)', selfDrives: false, selfPacks: false }
    ] as const
  ).map((s) => {
    const fixedWeekly =
      result.logisticsCost +
      (s.selfDrives ? 0 : result.drivingLabourCost) +
      result.weeklyFixedCosts;
    const avgContributionMarginPerBox =
      avgSellPerBox - avgCostPerBox - (s.selfPacks ? 0 : packingCostPerBox);
    const breakEvenBoxesPerWeek =
      avgContributionMarginPerBox > 0 ? fixedWeekly / avgContributionMarginPerBox : null;

    const drivingCost = s.selfDrives ? 0 : result.drivingLabourCost;
    const packingCost = s.selfPacks ? 0 : result.packingLabourCost;
    const totalLabourCost = drivingCost + packingCost;
    return {
      ...s,
      drivingCost,
      packingCost,
      totalLabourCost,
      netProfit: base - totalLabourCost,
      breakEvenBoxesPerWeek
    };
  });
}
