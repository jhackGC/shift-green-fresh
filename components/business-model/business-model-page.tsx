'use client';

import {
  computeBusinessModel,
  computeLabourScenarios,
  computeOwnVehicleCostPerTrip,
  computeTieredDeliveryFee
} from 'lib/business-model/calc';
import {
  DEFAULT_ASSUMPTIONS,
  type BoxMixEntry,
  type BusinessAssumptions,
  type BusinessModel,
  type LogisticsMode,
  type NonPerishableMixEntry
} from 'lib/business-model/types';
import type { Box } from 'lib/boxes/types';
import type { NonPerishableItem } from 'lib/non-perishables/types';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

function formatMoney(n: number): string {
  if (Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Rough payload-capacity bands for common vehicle classes — produce is bulky/light relative to
 *  its weight (lots of air in a crate of veg), so these lean toward "what fits" as much as "what
 *  it weighs"; treat as a starting point, not a spec. */
function vehicleGuide(kg: number): string {
  if (kg <= 0) return 'Set a box mix to estimate vehicle size.';
  if (kg < 300) return `${kg.toFixed(0)}kg fits an SUV/wagon or a small ute tray.`;
  if (kg < 700) return `${kg.toFixed(0)}kg — a single-cab ute or small van (e.g. Kangoo, Caddy).`;
  if (kg < 1200)
    return `${kg.toFixed(0)}kg — a 1-tonne ute or mid van (e.g. HiAce, Transit, Trafic).`;
  if (kg < 3000) return `${kg.toFixed(0)}kg — a large van or light truck (e.g. Isuzu NPR, Canter).`;
  return `${kg.toFixed(0)}kg — into truck territory; a single van/ute run likely can't cover this in one trip.`;
}

/**
 * Rough physical-handling estimate for one trip's worth of kg — separate from "packing minutes/
 * box" in the model (that's assembling customer boxes; this is moving bulk wholesale packs
 * between stall, vehicle, and unload point). Based on ~15kg/minute sustained solo throughput with
 * a two-wheeled sack trolley moving 15–20kg packs, × 2 passes (load at market, unload at the
 * other end) — a ballpark, not a timed measurement.
 */
function loadingDemand(kgPerTrip: number): { minutes: number; rating: string; note: string } {
  if (kgPerTrip <= 0) return { minutes: 0, rating: '—', note: 'Set a box mix to estimate.' };
  const minutes = (kgPerTrip / 15) * 2;
  if (kgPerTrip < 150) {
    return { minutes, rating: 'Light', note: 'A handful of packs — manageable without a trolley.' };
  }
  if (kgPerTrip < 400) {
    return {
      minutes,
      rating: 'Moderate',
      note: 'Real work, but sustainable solo with a two-wheeled trolley.'
    };
  }
  if (kgPerTrip < 800) {
    return {
      minutes,
      rating: 'Demanding',
      note: 'Genuine fatigue/injury risk doing this solo week after week — a trolley stops being optional, and a second person or tail-lift is worth considering.'
    };
  }
  return {
    minutes,
    rating: 'Very demanding',
    note: 'Beyond what one person should sustain alone — plan for a second person or mechanical loading aid.'
  };
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  prefix,
  suffix
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-neutral-500">
      <span>{label}</span>
      <span className="flex items-center gap-1 font-mono">
        {prefix}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-20 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-right text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
        {suffix}
      </span>
    </label>
  );
}

export function BusinessModelPage({
  boxes,
  nonPerishables,
  initialModel
}: {
  boxes: Box[];
  nonPerishables: NonPerishableItem[];
  initialModel: BusinessModel;
}) {
  const [assumptions, setAssumptions] = useState<BusinessAssumptions>(
    initialModel.assumptions ?? DEFAULT_ASSUMPTIONS
  );
  const [boxMix, setBoxMix] = useState<BoxMixEntry[]>(() =>
    boxes.map((b) => ({
      boxId: b.id,
      boxesPerWeek: initialModel.boxMix.find((m) => m.boxId === b.id)?.boxesPerWeek ?? 0
    }))
  );
  const [nonPerishableMix, setNonPerishableMix] = useState<NonPerishableMixEntry[]>(() =>
    nonPerishables.map((i) => ({
      itemId: i.id,
      unitsPerWeek: initialModel.nonPerishableMix?.find((m) => m.itemId === i.id)?.unitsPerWeek ?? 0
    }))
  );
  const [saving, setSaving] = useState(false);

  function updateAssumption<K extends keyof BusinessAssumptions>(
    key: K,
    value: BusinessAssumptions[K]
  ) {
    setAssumptions((prev) => ({ ...prev, [key]: value }));
  }
  function updateBoxCount(boxId: string, boxesPerWeek: number) {
    setBoxMix((prev) => prev.map((m) => (m.boxId === boxId ? { ...m, boxesPerWeek } : m)));
  }
  function updateNonPerishableCount(itemId: string, unitsPerWeek: number) {
    setNonPerishableMix((prev) =>
      prev.map((m) => (m.itemId === itemId ? { ...m, unitsPerWeek } : m))
    );
  }

  const result = useMemo(
    () => computeBusinessModel(boxes, boxMix, nonPerishables, nonPerishableMix, assumptions),
    [boxes, boxMix, nonPerishables, nonPerishableMix, assumptions]
  );

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/business-model', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assumptions, boxMix, nonPerishableMix })
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      toast.success('Saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const netProfitTone =
    result.netProfit > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : result.netProfit < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-black dark:text-white';

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 pb-24 pt-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-300 pb-4 dark:border-neutral-700">
        <div className="max-w-[70ch]">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Business Model</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            A weekly P&amp;L for the box trial — real box costs/prices from{' '}
            <code className="text-xs">data/boxes.json</code>, plus your own assumptions for
            logistics and labour. Adjust anything below; nothing here overwrites the box recipes
            themselves.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="whitespace-nowrap rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Save assumptions
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* Assumptions */}
        <div className="flex flex-col gap-4 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Pricing</h2>
          <NumberField
            label="Target margin"
            suffix="%"
            min={-50}
            value={assumptions.marginPercent}
            onChange={(v) => updateAssumption('marginPercent', v)}
          />
          <p className="-mt-2 text-[11px] text-neutral-400">
            Applied live to every box's wholesale cost here — a scenario knob, separate from
            whatever margin each box was saved with in the box builder. A box with a researched RRP
            still uses that fixed price regardless of this. Negative margin means selling below
            wholesale cost — a genuine produce subsidy, not just a thin margin. Non-perishables
            below are meant to fund that gap; the P&amp;L shows both sides so you can see whether
            they actually do.
          </p>

          {/* Transport — both options shown together so "is it worth it to have it sent"
              is a straight comparison, not something you toggle back and forth to see. */}
          <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide">Transport</h2>
          <NumberField
            label="Trips / week"
            value={assumptions.tripsPerWeek}
            onChange={(v) => updateAssumption('tripsPerWeek', v)}
          />

          {(() => {
            const ownVehicle = computeOwnVehicleCostPerTrip(assumptions);
            const delivery = computeTieredDeliveryFee(result.weeklyCogs);
            const deliveryCost = delivery.total;
            // Each version compared against delivery independently — "without driving hours" is
            // the true marginal cost if you're going anyway for another reason; "with" is the
            // honest cost if this trip only happens because of the pickup. They can land on
            // different sides of "cheaper than delivery," which is the point of splitting them.
            const transportOnlyCheaper = ownVehicle.transportOnly <= deliveryCost;
            const withLabourCheaper = ownVehicle.withLabour <= deliveryCost;
            return (
              <>
                <div
                  onClick={() => updateAssumption('logisticsMode', 'own-vehicle')}
                  className={`cursor-pointer rounded border p-2.5 ${
                    assumptions.logisticsMode === 'own-vehicle'
                      ? 'border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-900/20'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="mb-1.5 text-xs font-semibold">Pick up (own vehicle)</div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Without driving hours</span>
                    <span className="font-mono">
                      {formatMoney(ownVehicle.transportOnly)}/trip{' '}
                      {transportOnlyCheaper && (
                        <span className="text-emerald-600 dark:text-emerald-400">cheaper</span>
                      )}
                    </span>
                  </div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-neutral-500">
                      With driving hours ({assumptions.drivingHoursPerTrip}hrs @{' '}
                      {formatMoney(assumptions.hourlyLabourRate)}/hr)
                    </span>
                    <span className="font-mono">
                      {formatMoney(ownVehicle.withLabour)}/trip{' '}
                      {withLabourCheaper && (
                        <span className="text-emerald-600 dark:text-emerald-400">cheaper</span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <NumberField
                      label="Distance (one way)"
                      suffix="km"
                      value={assumptions.distanceKmOneWay}
                      onChange={(v) => updateAssumption('distanceKmOneWay', v)}
                    />
                    <NumberField
                      label="Diesel price"
                      prefix="$"
                      step={0.05}
                      suffix="/L"
                      value={assumptions.fuelPricePerLitre}
                      onChange={(v) => updateAssumption('fuelPricePerLitre', v)}
                    />
                    <NumberField
                      label="Fuel consumption"
                      step={0.5}
                      suffix="L/100km"
                      value={assumptions.fuelConsumptionL100km}
                      onChange={(v) => updateAssumption('fuelConsumptionL100km', v)}
                    />
                    <NumberField
                      label="Vehicle cost / trip (maint., rego, depr.)"
                      prefix="$"
                      value={assumptions.vehicleCostPerTrip}
                      onChange={(v) => updateAssumption('vehicleCostPerTrip', v)}
                    />
                  </div>
                </div>

                <div
                  onClick={() => updateAssumption('logisticsMode', 'delivery-service')}
                  className={`cursor-pointer rounded border p-2.5 ${
                    assumptions.logisticsMode === 'delivery-service'
                      ? 'border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-900/20'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                    <span>
                      Sent to me (delivery){' '}
                      {cheaper === 'delivery-service' && (
                        <span className="text-emerald-600 dark:text-emerald-400">cheaper</span>
                      )}
                    </span>
                    <span className="font-mono">{formatMoney(deliveryCost)}/trip</span>
                  </div>
                  <div className="mb-1.5 text-[10px] text-neutral-400">
                    No driving labour — nobody drives. eco-farms' real rate card, tiered by order
                    value:
                  </div>
                  <div className="flex flex-col gap-0.5 text-[11px] text-neutral-500">
                    <div className="flex justify-between">
                      <span>Order value (produce COGS)</span>
                      <span className="font-mono">{formatMoney(result.weeklyCogs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tier fee</span>
                      <span className="font-mono">{formatMoney(delivery.tierFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fuel levy</span>
                      <span className="font-mono">{formatMoney(delivery.fuelLevy)}</span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400">
                  Click a card to use it in the model below. Figures above already include driving
                  labour for pick-up — that's the fair comparison, not just the trip fee.
                </p>
              </>
            );
          })()}

          <div className="rounded border border-neutral-200 bg-neutral-50 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex justify-between font-semibold">
              <span>Weekly run weight (current mix)</span>
              <span className="font-mono">{result.totalWeeklyKg.toFixed(0)}kg</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">
              {vehicleGuide(result.totalWeeklyKg)} — rough payload bands only, check your actual
              vehicle's rated payload before relying on this.
            </p>
          </div>

          {(() => {
            const kgPerTrip =
              assumptions.tripsPerWeek > 0 ? result.totalWeeklyKg / assumptions.tripsPerWeek : 0;
            const demand = loadingDemand(kgPerTrip);
            return (
              <div className="rounded border border-neutral-200 bg-neutral-50 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex justify-between font-semibold">
                  <span>Loading/unloading — {kgPerTrip.toFixed(0)}kg/trip</span>
                  <span
                    className={
                      demand.rating === 'Demanding' || demand.rating === 'Very demanding'
                        ? 'text-amber-600 dark:text-amber-400'
                        : ''
                    }
                  >
                    {demand.rating}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-400">
                  ~{demand.minutes.toFixed(0)} min/trip estimated (load at market + unload at the
                  other end). {demand.note}
                </p>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Not currently counted in "Total labour" below — that's driving + packing into
                  customer boxes only, not moving bulk wholesale packs. Add it to "Driving hours /
                  trip" below if you want it reflected in the P&amp;L.
                </p>
              </div>
            );
          })()}

          {/* Labour — driving only applies in pick-up mode; packing always applies. */}
          <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide">Labour</h2>
          <NumberField
            label="Labour rate (yours or hired)"
            prefix="$"
            suffix="/hr"
            value={assumptions.hourlyLabourRate}
            onChange={(v) => updateAssumption('hourlyLabourRate', v)}
          />
          <NumberField
            label="Driving hours / trip (pick-up only)"
            step={0.25}
            suffix="hrs"
            value={assumptions.drivingHoursPerTrip}
            onChange={(v) => updateAssumption('drivingHoursPerTrip', v)}
          />
          <NumberField
            label="Packing time / box"
            suffix="min"
            value={assumptions.packingMinutesPerBox}
            onChange={(v) => updateAssumption('packingMinutesPerBox', v)}
          />

          <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide">Other</h2>
          <NumberField
            label="Other weekly fixed costs"
            prefix="$"
            value={assumptions.weeklyFixedCosts}
            onChange={(v) => updateAssumption('weeklyFixedCosts', v)}
          />
          <input
            type="text"
            placeholder="What's the fixed cost for? e.g. pickup-point rent, insurance"
            value={assumptions.weeklyFixedCostsNote}
            onChange={(e) => updateAssumption('weeklyFixedCostsNote', e.target.value)}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />

          <p className="text-[11px] text-neutral-400">
            Transport cost and driving labour are per-trip, not per-box — one trip covers however
            many boxes it carries. That's why they sit in "fixed" costs below rather than scaling
            with volume; vehicle/order capacity isn't modelled here.
          </p>
        </div>

        {/* Box mix + P&L */}
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-neutral-300 dark:border-neutral-700">
            <div className="border-b border-neutral-300 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Weekly box mix — {result.totalBoxesPerWeek} boxes
              </h2>
            </div>
            {boxes.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">
                No boxes saved yet — build some at /admin/boxes first.
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
                    <th className="px-3 py-2">Box</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Sell</th>
                    <th className="px-3 py-2 text-right">Boxes/week</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {boxes.map((box) => {
                    const mix = boxMix.find((m) => m.boxId === box.id);
                    return (
                      <tr
                        key={box.id}
                        className="border-b border-neutral-200 dark:border-neutral-800"
                      >
                        <td className="px-3 py-2 font-medium">{box.name}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {formatMoney(box.wholesaleCost)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {formatMoney(box.sellPrice)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={mix?.boxesPerWeek ?? 0}
                            onChange={(e) => updateBoxCount(box.id, Number(e.target.value) || 0)}
                            className="w-16 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-right font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {formatMoney((mix?.boxesPerWeek ?? 0) * box.sellPrice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-lg border border-neutral-300 dark:border-neutral-700">
            <div className="border-b border-neutral-300 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Weekly non-perishables mix — {result.nonPerishableLines.length} lines
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Manage the item list at{' '}
                <a href="/admin/non-perishables" className="underline hover:text-teal-600">
                  /admin/non-perishables
                </a>
                . These feed straight into the P&amp;L below, alongside the box mix.
              </p>
            </div>
            {nonPerishables.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">
                No non-perishable items yet — add some at /admin/non-perishables.
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Sell</th>
                    <th className="px-3 py-2 text-right">Units/week</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {nonPerishables.map((item) => {
                    const mix = nonPerishableMix.find((m) => m.itemId === item.id);
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-neutral-200 dark:border-neutral-800"
                      >
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {formatMoney(item.cost)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {formatMoney(item.sellPrice)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={mix?.unitsPerWeek ?? 0}
                            onChange={(e) =>
                              updateNonPerishableCount(item.id, Number(e.target.value) || 0)
                            }
                            className="w-16 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-right font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {formatMoney((mix?.unitsPerWeek ?? 0) * item.sellPrice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-lg border border-neutral-300 dark:border-neutral-700">
            <div className="border-b border-neutral-300 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Weekly P&amp;L</h2>
            </div>
            <div className="flex flex-col gap-1.5 p-4 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Produce (boxes)
              </p>
              <Row label="Revenue" value={result.weeklyRevenue} />
              <Row label="Cost of goods (wholesale)" value={-result.weeklyCogs} />
              <Row label="Produce gross profit" value={result.grossProfit} bold />

              {result.nonPerishableLines.length > 0 && (
                <>
                  <hr className="my-1 border-neutral-200 dark:border-neutral-800" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Non-perishables
                  </p>
                  <Row label="Revenue" value={result.nonPerishableRevenue} />
                  <Row label="Cost of goods" value={-result.nonPerishableCogs} />
                  <Row label="Non-perishables profit" value={result.nonPerishableProfit} bold />
                  {result.grossProfit < 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Produce is running at a {formatMoney(-result.grossProfit)} loss (subsidized
                      pricing) — non-perishables profit needs to cover that gap before anything's
                      left for transport, labour, or actual profit.
                    </p>
                  )}
                </>
              )}

              <hr className="my-1 border-neutral-200 dark:border-neutral-800" />
              <Row
                label={`Transport (${assumptions.logisticsMode === 'own-vehicle' ? 'pick up' : 'delivery'}, ${assumptions.tripsPerWeek}× trip/week)`}
                value={-result.logisticsCost}
              />
              <Row label="Driving labour" value={-result.drivingLabourCost} />
              <Row label="Packing labour" value={-result.packingLabourCost} />
              <Row label="Other fixed costs" value={-result.weeklyFixedCosts} />
              <hr className="my-1 border-neutral-200 dark:border-neutral-800" />
              <div className="flex justify-between text-base font-bold">
                <span>Net profit / week</span>
                <span className={`font-mono ${netProfitTone}`}>
                  {formatMoney(result.netProfit)}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-neutral-500">
                <span>Total labour</span>
                <span className="font-mono">
                  {result.totalLabourHours.toFixed(1)}hrs/week ({result.drivingHours.toFixed(1)}{' '}
                  driving + {result.packingHours.toFixed(1)} packing)
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Break-even</h2>
            {result.breakEvenBoxesPerWeek != null ? (
              <p className="mt-1 text-sm">
                At the current box mix ratio, you break even at{' '}
                <span className="font-mono font-semibold text-teal-700 dark:text-teal-300">
                  {Math.ceil(result.breakEvenBoxesPerWeek)} boxes/week
                </span>{' '}
                — you're currently at {result.totalBoxesPerWeek}, contribution margin{' '}
                {formatMoney(result.avgContributionMarginPerBox ?? 0)}/box.
              </p>
            ) : result.avgContributionMarginPerBox != null &&
              result.avgContributionMarginPerBox <= 0 ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                This mix loses money on every box after packing labour (
                {formatMoney(result.avgContributionMarginPerBox)}
                /box) — no volume fixes that; the box prices or packing time need to change first.
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">
                Set a box mix above to see break-even.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-neutral-300 dark:border-neutral-700">
            <div className="border-b border-neutral-300 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Labour scenarios — who does the work
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Same box mix, same revenue — the only thing changing is whether driving/packing cost
                you cash (paid out) or just your time (you do it).
              </p>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
                  <th className="px-3 py-2">Scenario</th>
                  <th className="px-3 py-2 text-right">Driving cost</th>
                  <th className="px-3 py-2 text-right">Packing cost</th>
                  <th className="px-3 py-2 text-right">Total labour</th>
                  <th className="px-3 py-2 text-right">Net profit</th>
                  <th className="px-3 py-2 text-right">Break-even</th>
                </tr>
              </thead>
              <tbody>
                {computeLabourScenarios(result, assumptions).map((s) => (
                  <tr key={s.label} className="border-b border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2">{s.label}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {s.selfDrives ? (
                        <span className="text-neutral-400">you — $0</span>
                      ) : (
                        formatMoney(s.drivingCost)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {s.selfPacks ? (
                        <span className="text-neutral-400">you — $0</span>
                      ) : (
                        formatMoney(s.packingCost)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatMoney(s.totalLabourCost)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold">
                      <span
                        className={
                          s.netProfit > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : s.netProfit < 0
                              ? 'text-red-600 dark:text-red-400'
                              : ''
                        }
                      >
                        {formatMoney(s.netProfit)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {s.breakEvenBoxesPerWeek != null ? (
                        `${Math.ceil(s.breakEvenBoxesPerWeek)} boxes/wk`
                      ) : (
                        <span className="text-red-500">never</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-3 text-[11px] text-neutral-400">
              "$0" cash cost isn't free — it's your own {result.totalLabourHours.toFixed(1)}{' '}
              hrs/week spent instead of doing something else. At the modelled $
              {assumptions.hourlyLabourRate}/hr, that's the opportunity cost even when no cash
              actually changes hands.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  const tone = value < 0 ? 'text-red-600 dark:text-red-400' : '';
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''}`}>
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <span className={`font-mono ${tone}`}>{formatMoney(value)}</span>
    </div>
  );
}
