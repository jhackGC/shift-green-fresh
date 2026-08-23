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
  /** delivery-service mode: having the produce sent to you instead of driving to collect it. */
  deliveryFeePerTrip: number;
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
  // Default for a light commercial van/ute doing this kind of run — check against your actual
  // vehicle's real-world figure, it varies a lot by vehicle and load.
  fuelConsumptionL100km: 10,
  vehicleCostPerTrip: 15,
  drivingHoursPerTrip: 2,
  deliveryFeePerTrip: 60,
  tripsPerWeek: 1,
  hourlyLabourRate: 30,
  packingMinutesPerBox: 8,
  weeklyFixedCosts: 0,
  weeklyFixedCostsNote: ''
};

export type BoxMixEntry = {
  boxId: string;
  boxesPerWeek: number;
};

export type BusinessModel = {
  assumptions: BusinessAssumptions;
  boxMix: BoxMixEntry[];
  updatedAt: string;
};

export const EMPTY_BUSINESS_MODEL: BusinessModel = {
  assumptions: DEFAULT_ASSUMPTIONS,
  boxMix: [],
  updatedAt: new Date(0).toISOString()
};
