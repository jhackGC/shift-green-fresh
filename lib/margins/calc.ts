import { ProduceRow } from './data';

export type FreightAssumption = {
  costPerTrip: number;
  kgPerTrip: number;
};

export type MarginTier = 'good' | 'warn' | 'bad';

export type ComputedMargin = {
  wholesalePerUnit: number;
  landedPerRetailUnit: number;
  marginDollar: number;
  marginPercent: number;
};

export function freightPerKg(freight: FreightAssumption): number {
  return freight.kgPerTrip > 0 ? freight.costPerTrip / freight.kgPerTrip : 0;
}

/**
 * Normalizes a wholesale box/bag/tray/bunch price and a retail unit price onto the same
 * basis, applying a flat $/kg freight surcharge, so the two are actually comparable.
 *
 * - Same-unit rows (kg vs kg, or each vs each) convert directly.
 * - Cross-unit rows (e.g. wholesale sold by the kg, retail sold each — avocados; or
 *   wholesale sold by the bunch, retail sold by the kg — thyme) use `avgWeightG` as the
 *   bridge between the two units.
 */
export function computeMargin(row: ProduceRow, freight: FreightAssumption): ComputedMargin {
  const fpk = freightPerKg(freight);
  const weightKg = row.avgWeightG != null ? row.avgWeightG / 1000 : null;

  const wholesalePerUnit = row.wholesaleQty > 0 ? row.wholesalePrice / row.wholesaleQty : NaN;
  const freightAddOnBase = row.wholesaleUnit === 'kg' ? fpk : fpk * (weightKg ?? 0);
  const landedBase = wholesalePerUnit + freightAddOnBase;

  let landedPerRetailUnit: number;
  if (row.wholesaleUnit === row.retailUnit) {
    landedPerRetailUnit = landedBase;
  } else if (row.wholesaleUnit === 'kg' && row.retailUnit === 'each') {
    landedPerRetailUnit = weightKg != null ? landedBase * weightKg : NaN;
  } else if (row.wholesaleUnit === 'each' && row.retailUnit === 'kg') {
    landedPerRetailUnit = weightKg ? landedBase / weightKg : NaN;
  } else {
    landedPerRetailUnit = landedBase;
  }

  const marginDollar = row.retailPrice - landedPerRetailUnit;
  const marginPercent = row.retailPrice !== 0 ? (marginDollar / row.retailPrice) * 100 : NaN;

  return { wholesalePerUnit, landedPerRetailUnit, marginDollar, marginPercent };
}

export function marginTier(pct: number): MarginTier {
  if (Number.isNaN(pct)) return 'warn';
  if (pct < 0) return 'bad';
  if (pct < 30) return 'warn';
  return 'good';
}

export function formatMoney(n: number, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`;
}

export function unitLabel(u: 'kg' | 'each'): string {
  return u === 'kg' ? '/kg' : '/ea';
}
