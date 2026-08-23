import { priceForMargin } from '../margins/calc';
import type { Box } from '../boxes/types';
import type { BoxMixEntry, BusinessAssumptions } from './types';

export type BoxMixLine = {
  boxId: string;
  boxName: string;
  boxesPerWeek: number;
  costPerBox: number;
  sellPerBox: number;
  weeklyRevenue: number;
  weeklyCogs: number;
};

export type BusinessModelResult = {
  lines: BoxMixLine[];
  totalBoxesPerWeek: number;
  weeklyRevenue: number;
  weeklyCogs: number;
  /** revenue - cogs, before logistics/labour/fixed costs. */
  grossProfit: number;
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

/**
 * Own-vehicle cost per trip, two ways: transport-only (fuel + vehicle cost — what the "Transport"
 * comparison card used to show, in isolation) and fully-loaded with driving labour included. The
 * fair comparison against a delivery fee is the fully-loaded figure — delivery has no labour
 * equivalent, so comparing it to transport-only understates what picking up actually costs.
 */
export function computeOwnVehicleCostPerTrip(a: BusinessAssumptions): {
  transportOnly: number;
  withLabour: number;
} {
  const transportOnly = computeFuelCostPerTrip(a) + a.vehicleCostPerTrip;
  return { transportOnly, withLabour: transportOnly + a.drivingHoursPerTrip * a.hourlyLabourRate };
}

/** Round-trip fuel cost from distance × consumption × price — not entered directly, since those
 *  three are what's actually known/verifiable, not an assumed dollar figure. */
export function computeFuelCostPerTrip(a: BusinessAssumptions): number {
  const roundTripKm = a.distanceKmOneWay * 2;
  return (roundTripKm / 100) * a.fuelConsumptionL100km * a.fuelPricePerLitre;
}

/**
 * Logistics cost is trip-based, not per-box — one truck (or one delivery) covers however many
 * boxes it's carrying, up to whatever capacity really exists (not modelled here). That's why it
 * sits in the "fixed" side of the break-even math rather than scaling with box count.
 */
export function computeLogisticsCost(a: BusinessAssumptions): {
  logisticsCost: number;
  drivingLabourCost: number;
} {
  if (a.logisticsMode === 'own-vehicle') {
    return {
      logisticsCost: (computeFuelCostPerTrip(a) + a.vehicleCostPerTrip) * a.tripsPerWeek,
      drivingLabourCost: a.drivingHoursPerTrip * a.tripsPerWeek * a.hourlyLabourRate
    };
  }
  return { logisticsCost: a.deliveryFeePerTrip * a.tripsPerWeek, drivingLabourCost: 0 };
}

export function computeBusinessModel(
  boxes: Box[],
  boxMix: BoxMixEntry[],
  a: BusinessAssumptions
): BusinessModelResult {
  const boxById = new Map(boxes.map((b) => [b.id, b]));

  const lines: BoxMixLine[] = boxMix
    .filter((m) => m.boxesPerWeek > 0)
    .map((m) => {
      const box = boxById.get(m.boxId);
      const costPerBox = box?.wholesaleCost ?? 0;
      // A researched RRP is a deliberate, fixed price — respect it. Otherwise sell price tracks
      // this model's live margin assumption, not whatever margin the box happened to be saved
      // with, so you can scenario-test margin changes without re-saving every box.
      const sellPerBox =
        box?.researchedRrp ?? Math.round(priceForMargin(costPerBox, a.marginPercent));
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

  const { logisticsCost, drivingLabourCost } = computeLogisticsCost(a);
  const packingHours = totalBoxesPerWeek * (a.packingMinutesPerBox / 60);
  const packingLabourCost = packingHours * a.hourlyLabourRate;
  const drivingHours =
    a.logisticsMode === 'own-vehicle' ? a.drivingHoursPerTrip * a.tripsPerWeek : 0;
  const totalLabourHours = drivingHours + packingHours;
  const weeklyFixedCosts = a.weeklyFixedCosts;

  const totalWeeklyCosts =
    weeklyCogs + logisticsCost + drivingLabourCost + packingLabourCost + weeklyFixedCosts;
  const netProfit = weeklyRevenue - totalWeeklyCosts;

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
};

/**
 * Four staffing scenarios for the same box mix — driving and packing done yourself (no cash
 * cost, just your time) vs paid out (a real weekly expense at the modelled labour rate), all four
 * combinations. In delivery mode drivingLabourCost is already zero (nobody drives), so the
 * "self-drives" toggle collapses to no difference there — that's expected, not a bug.
 */
export function computeLabourScenarios(result: BusinessModelResult): LabourScenario[] {
  const base =
    result.weeklyRevenue - result.weeklyCogs - result.logisticsCost - result.weeklyFixedCosts;
  return (
    [
      { label: 'You do both (driving + packing)', selfDrives: true, selfPacks: true },
      { label: 'You drive, pay for packing', selfDrives: true, selfPacks: false },
      { label: 'You pack, pay for driving', selfDrives: false, selfPacks: true },
      { label: 'You do neither (pay for both)', selfDrives: false, selfPacks: false }
    ] as const
  ).map((s) => {
    const drivingCost = s.selfDrives ? 0 : result.drivingLabourCost;
    const packingCost = s.selfPacks ? 0 : result.packingLabourCost;
    const totalLabourCost = drivingCost + packingCost;
    return { ...s, drivingCost, packingCost, totalLabourCost, netProfit: base - totalLabourCost };
  });
}
