/**
 * A single, editable "business model" for the pickup-only box trial: the assumptions that turn a
 * box mix (from lib/boxes) into a weekly P&L — logistics (own vehicle vs a delivery service),
 * labour (driving + packing), and any other fixed weekly cost — plus the break-even point those
 * assumptions imply. There's one live model, not a history of scenarios; editing it overwrites it.
 */

export type LogisticsMode = 'own-vehicle' | 'delivery-service';

export type BusinessAssumptions = {
  /**
   * Target margin (%) applied live to each box's wholesale cost to get its sell price in this
   * model — a scenario-testing knob, separate from the margin baked into a box at save time in
   * the box builder. A box with a `researchedRrp` set still uses that fixed price regardless of
   * this value, same priority order as the box builder itself.
   */
  marginPercent: number;
  logisticsMode: LogisticsMode;
  /** own-vehicle mode — fuel cost is derived from these three, not entered directly: */
  distanceKmOneWay: number;
  fuelPricePerLitre: number;
  fuelConsumptionL100km: number;
  /** Maintenance/depreciation/rego allocated to one trip — not just fuel. */
  vehicleCostPerTrip: number;
  drivingHoursPerTrip: number;
  /** delivery-service mode: having the produce sent to you instead of driving to collect it —
   *  no assumption needed here, the fee is computed from eco-farms' real tiered rate card against
   *  the actual order value (see computeTieredDeliveryFee in calc.ts). */
  /** Shared by both modes — how many market trips (or deliveries) per week. */
  tripsPerWeek: number;
  /** $/hour value of your own time or hired labour — used for both driving and packing. */
  hourlyLabourRate: number;
  packingMinutesPerBox: number;
  /** Anything else fixed weekly regardless of volume — pickup-point rent, insurance, etc. */
  weeklyFixedCosts: number;
  weeklyFixedCostsNote: string;
};

export const DEFAULT_ASSUMPTIONS: BusinessAssumptions = {
  marginPercent: 35,
  logisticsMode: 'own-vehicle',
  distanceKmOneWay: 100,
  fuelPricePerLitre: 2.5,
  // Real Renault Master figures: 9 L/100km urban, 8.5 L/100km highway. The 100km market run is
  // mostly highway (M1) with short urban legs at each end, so this is that blend, not a generic
  // van guess — adjust if the actual route mix (or the vehicle) changes.
  fuelConsumptionL100km: 8.6,
  vehicleCostPerTrip: 15,
  drivingHoursPerTrip: 2,
  tripsPerWeek: 1,
  hourlyLabourRate: 30,
  packingMinutesPerBox: 8,
  weeklyFixedCosts: 0,
  weeklyFixedCostsNote: ''
};

export type BoxMixEntry = {
  boxId: string;
  boxesPerWeek: number;
  /**
   * Per-box margin override (%). When set, this box prices off its own margin instead of the
   * model's global `marginPercent` — which is what makes a *price ladder* modellable: small boxes
   * carried at a higher margin so the mid sizes read as obviously better value, larger boxes at a
   * lower one to reward buying volume. Unset means "follow the global margin". A box with a
   * `researchedRrp` still ignores both, same priority order as everywhere else.
   */
  marginPercent?: number;
};

export type NonPerishableMixEntry = {
  itemId: string;
  unitsPerWeek: number;
};

export type BusinessModel = {
  assumptions: BusinessAssumptions;
  boxMix: BoxMixEntry[];
  nonPerishableMix: NonPerishableMixEntry[];
  updatedAt: string;
};

export const EMPTY_BUSINESS_MODEL: BusinessModel = {
  assumptions: DEFAULT_ASSUMPTIONS,
  boxMix: [],
  nonPerishableMix: [],
  updatedAt: new Date(0).toISOString()
};
