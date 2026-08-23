'use client';

import {
  computeMargin,
  formatMoney,
  marginTier,
  unitLabel,
  type FreightAssumption
} from 'lib/margins/calc';
import {
  DEFAULT_FREIGHT,
  PRODUCE_ROWS,
  UNMATCHED_WHOLESALE,
  type ProduceRow
} from 'lib/margins/data';
import { useMemo, useState } from 'react';

type SortKey = 'product' | 'category' | 'margin';
type SortState = { key: SortKey | null; dir: 1 | -1 };

const TIER_CLASSES: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  bad: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
};

const inputClass =
  'w-16 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-right font-mono text-xs text-black dark:border-neutral-700 dark:bg-neutral-800 dark:text-white';

export function MarginLedger() {
  const [rows, setRows] = useState<ProduceRow[]>(() => PRODUCE_ROWS.map((r) => ({ ...r })));
  const [freight, setFreight] = useState<FreightAssumption>({ ...DEFAULT_FREIGHT });
  const [sort, setSort] = useState<SortState>({ key: null, dir: 1 });

  const computed = useMemo(() => {
    const map = new Map<number, ReturnType<typeof computeMargin>>();
    rows.forEach((row) => map.set(row.id, computeMargin(row, freight)));
    return map;
  }, [rows, freight]);

  const summary = useMemo(() => {
    let good = 0;
    let warn = 0;
    let bad = 0;
    rows.forEach((row) => {
      const tier = marginTier(computed.get(row.id)!.marginPercent);
      if (tier === 'good') good++;
      else if (tier === 'warn') warn++;
      else bad++;
    });
    return { good, warn, bad, total: rows.length };
  }, [rows, computed]);

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sort.key === 'product') {
        av = a.product.toLowerCase();
        bv = b.product.toLowerCase();
      } else if (sort.key === 'category') {
        av = a.category;
        bv = b.category;
      } else {
        av = computed.get(a.id)!.marginPercent;
        bv = computed.get(b.id)!.marginPercent;
        if (Number.isNaN(av)) av = -Infinity;
        if (Number.isNaN(bv)) bv = -Infinity;
      }
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
    return copy;
  }, [rows, sort, computed]);

  function updateRow(id: number, field: keyof ProduceRow, value: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: (prev.dir * -1) as 1 | -1 } : { key, dir: 1 }
    );
  }

  function reset() {
    setRows(PRODUCE_ROWS.map((r) => ({ ...r })));
    setFreight({ ...DEFAULT_FREIGHT });
    setSort({ key: null, dir: 1 });
  }

  const fpk = freight.kgPerTrip > 0 ? freight.costPerTrip / freight.kgPerTrip : 0;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 pb-24 pt-6 md:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-300 pb-4 dark:border-neutral-700">
        <div className="max-w-[62ch]">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Produce Margin Ledger</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Every wholesale box/bag/tray line from Eco-Farms Brisbane matched against the Fresh
            Organic Merrimac retail board, converted to a common unit so the margins are actually
            comparable. Every field below is editable and recalculates live.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-neutral-500 dark:text-neutral-500">
            <span>Wholesale: Eco-Farms Brisbane, w/c 24&ndash;26 Aug 2026</span>
            <span>Retail: Fresh Organic Merrimac board, 23 Aug 2026</span>
            <span>Fresh produce is GST-free in Australia &mdash; no GST adjustment applied</span>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="whitespace-nowrap rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:border-teal-600 hover:text-teal-600 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-teal-400 dark:hover:text-teal-400"
        >
          ↺ Reset to original values
        </button>
      </header>

      {/* Freight assumptions */}
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Freight assumption
        </span>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Cost per Brisbane&rarr;GC trip
          <span className="flex items-center gap-1">
            $
            <input
              type="number"
              min={0}
              step={1}
              value={freight.costPerTrip}
              onChange={(e) =>
                setFreight((f) => ({ ...f, costPerTrip: Number(e.target.value) || 0 }))
              }
              className={inputClass}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Produce carried per trip
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              step={10}
              value={freight.kgPerTrip}
              onChange={(e) =>
                setFreight((f) => ({ ...f, kgPerTrip: Number(e.target.value) || 0 }))
              }
              className={inputClass}
            />
            kg
          </span>
        </label>
        <div className="rounded bg-teal-50 px-3 py-1.5 font-mono text-sm text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
          &asymp; <b>{formatMoney(fpk)}</b> / kg landed onto every wholesale line
        </div>
        <span className="max-w-[30ch] text-xs text-amber-700 dark:text-amber-400">
          Placeholder &mdash; no real courier/fuel quote yet. Replace with actuals when you have
          one.
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Healthy margin (≥30%)" value={summary.good} tone="good" />
        <Stat label="Thin margin (0–30%)" value={summary.warn} tone="warn" />
        <Stat label="Loss at current prices" value={summary.bad} tone="bad" />
        <Stat label="Total matched lines" value={summary.total} />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-300 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Matched items &mdash; {sortedRows.length} lines
          </h2>
          <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
            <span>
              <i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
              Healthy (&ge;30%)
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
              Thin (0&ndash;30%)
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
              Loss
            </span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              &#9873; low-confidence reading &mdash; verify against source
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
                <SortableTh
                  label="Product"
                  active={sort.key === 'product'}
                  dir={sort.dir}
                  onClick={() => toggleSort('product')}
                />
                <SortableTh
                  label="Cat."
                  active={sort.key === 'category'}
                  dir={sort.dir}
                  onClick={() => toggleSort('category')}
                />
                <th className="px-3 py-2">Wholesale box</th>
                <th className="px-3 py-2">Avg wt (g)</th>
                <th className="px-3 py-2 text-right">Wholesale $/unit</th>
                <th className="px-3 py-2 text-right">Landed $/unit</th>
                <th className="px-3 py-2">Retail price</th>
                <SortableTh
                  label="Margin"
                  active={sort.key === 'margin'}
                  dir={sort.dir}
                  onClick={() => toggleSort('margin')}
                  numeric
                />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const c = computed.get(row.id)!;
                const tier = marginTier(c.marginPercent);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-200 hover:bg-teal-50/60 dark:border-neutral-800 dark:hover:bg-teal-900/10"
                  >
                    <td className="max-w-[190px] px-3 py-2 align-top">
                      <div className="font-medium">
                        {row.product}{' '}
                        {row.confidence === 'verify' && (
                          <span
                            title={row.note}
                            className="cursor-help font-bold text-amber-600 dark:text-amber-400"
                          >
                            &#9873;
                          </span>
                        )}
                      </div>
                      {row.note && (
                        <div className="mt-0.5 max-w-[26ch] text-xs text-neutral-400">
                          {row.note}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] uppercase text-neutral-500 dark:border-neutral-700">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1 font-mono text-xs">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={row.wholesalePrice}
                          onChange={(e) =>
                            updateRow(row.id, 'wholesalePrice', Number(e.target.value) || 0)
                          }
                          className={inputClass}
                        />
                        /
                        <input
                          type="number"
                          min={0.01}
                          step={0.1}
                          value={row.wholesaleQty}
                          onChange={(e) =>
                            updateRow(row.id, 'wholesaleQty', Number(e.target.value) || 0)
                          }
                          className={inputClass}
                        />
                        <span className="text-neutral-400">
                          {row.wholesaleUnit === 'kg' ? 'kg' : 'ea'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-400">{row.wholesaleSource}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {row.avgWeightG != null ? (
                        <input
                          type="number"
                          min={1}
                          step={5}
                          value={row.avgWeightG}
                          onChange={(e) =>
                            updateRow(row.id, 'avgWeightG', Number(e.target.value) || 0)
                          }
                          className={inputClass}
                        />
                      ) : (
                        <span className="text-neutral-300 dark:text-neutral-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums">
                      {formatMoney(c.wholesalePerUnit)}
                      <span className="ml-0.5 text-neutral-400">
                        {unitLabel(row.wholesaleUnit)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums">
                      {formatMoney(c.landedPerRetailUnit)}
                      <span className="ml-0.5 text-neutral-400">{unitLabel(row.retailUnit)}</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1 font-mono text-xs">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={row.retailPrice}
                          onChange={(e) =>
                            updateRow(row.id, 'retailPrice', Number(e.target.value) || 0)
                          }
                          className={`${inputClass} w-[4.5rem]`}
                        />
                        <span className="text-neutral-400">{unitLabel(row.retailUnit)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-400">{row.retailProduct}</div>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${TIER_CLASSES[tier]}`}
                      >
                        {Number.isNaN(c.marginPercent)
                          ? '—'
                          : `${c.marginPercent >= 0 ? '+' : ''}${c.marginPercent.toFixed(0)}%`}
                      </span>
                      <div className="mt-1 font-mono text-xs text-neutral-400">
                        {formatMoney(c.marginDollar)}
                        {unitLabel(row.retailUnit)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Appendix */}
      <div className="rounded-lg border border-neutral-300 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Wholesale-only reference</h2>
        <p className="mt-1 max-w-[70ch] text-sm text-neutral-500">
          Lines from the Eco-Farms Brisbane list with no matching item on the retail board (so no
          margin can be computed) &mdash; kept here for reference only, not part of the calculator.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(UNMATCHED_WHOLESALE).map(([group, items]) => (
            <div key={group}>
              <h3 className="border-b border-dashed border-neutral-300 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:border-neutral-700">
                {group}
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-neutral-500">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Caveats */}
      <footer className="flex flex-col gap-1.5 border-t border-neutral-300 pt-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p className="font-semibold text-neutral-700 dark:text-neutral-300">
          Read before trusting a number:
        </p>
        <p>
          Retail prices were hand-transcribed from a photo of a market price board with handwritten
          corrections and multi-buy notes &mdash; rows marked &#9873; are genuinely hard to read and
          should be checked against the photo before you act on them.
        </p>
        <p>
          &quot;Avg weight&quot; fields are estimates used only to convert between $/kg and $/each
          (or to price freight on each-sold items) &mdash; replace with a real weighed sample where
          the margin is close to your decision threshold.
        </p>
        <p>
          No packing, wastage/spoilage, labour, or box/packaging cost is included yet &mdash; this
          is a landed-wholesale-cost-vs-retail-price comparison only, deliberately, as a first pass.
        </p>
        <p>
          Wholesale grade and organic certification were not individually cross-checked line-by-line
          against the retail board&apos;s cert-body codes (ACO/SXC/OFC/DA) &mdash; variety/quality
          may not always match exactly.
        </p>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'bad'
          ? 'text-red-600 dark:text-red-400'
          : 'text-black dark:text-white';
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-neutral-300 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
      <span className={`font-mono text-2xl font-bold tabular-nums ${toneClass}`}>{value}</span>
      <span className="text-xs uppercase tracking-wide text-neutral-500">{label}</span>
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  numeric
}: {
  label: string;
  active: boolean;
  dir: 1 | -1;
  onClick: () => void;
  numeric?: boolean;
}) {
  return (
    <th className={`px-3 py-2 ${numeric ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-teal-600 dark:hover:text-teal-400 ${
          active ? 'text-teal-600 dark:text-teal-400' : ''
        }`}
      >
        {label}
        {active && <span className="text-[9px]">{dir === 1 ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}
