'use client';

import type { Product, VendorPricing } from 'lib/vendor-pricing/types';
import { useMemo, useState } from 'react';

export type JoinedPricingRow = VendorPricing & {
  productName: string;
  category?: Product['category'];
};

type SortKey = 'product' | 'vendor' | 'pricePerKg';
type SortState = { key: SortKey | null; dir: 1 | -1 };
type StatusFilter = 'all' | 'priced' | 'needsConversion';

function formatMoney(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PricingTable({
  rows,
  productCount,
  vendorCount
}: {
  rows: JoinedPricingRow[];
  productCount: number;
  vendorCount: number;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortState>({ key: 'product', dir: 1 });

  const summary = useMemo(() => {
    let priced = 0;
    let needsConversion = 0;
    rows.forEach((r) => (r.needsConversionFactor ? needsConversion++ : priced++));
    return { priced, needsConversion, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === 'priced' && r.needsConversionFactor) return false;
      if (status === 'needsConversion' && !r.needsConversionFactor) return false;
      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        r.rawLabel.toLowerCase().includes(q) ||
        r.vendorCode.toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sort.key === 'product') {
        av = a.productName.toLowerCase();
        bv = b.productName.toLowerCase();
      } else if (sort.key === 'vendor') {
        av = a.vendorCode.toLowerCase();
        bv = b.vendorCode.toLowerCase();
      } else {
        av = a.pricePerDestinationUnit ?? -Infinity;
        bv = b.pricePerDestinationUnit ?? -Infinity;
      }
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
    return copy;
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: (prev.dir * -1) as 1 | -1 } : { key, dir: 1 }
    );
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 pb-24 pt-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-300 pb-4 dark:border-neutral-700">
        <div className="max-w-[62ch]">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Vendor Pricing</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Every product/pack line imported from vendor price lists, normalized to $/kg so lines
            from different vendors and pack sizes are directly comparable.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Products" value={productCount} />
        <Stat label="Vendors" value={vendorCount} />
        <Stat label="Priced ($/kg known)" value={summary.priced} tone="good" />
        <Stat label="Needs conversion factor" value={summary.needsConversion} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
        <input
          type="text"
          placeholder="Search product, vendor, or raw label…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
        <div className="flex gap-1 text-xs">
          {(['all', 'priced', 'needsConversion'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 font-medium ${
                status === s
                  ? 'border-teal-600 bg-teal-50 text-teal-700 dark:border-teal-400 dark:bg-teal-900/30 dark:text-teal-300'
                  : 'border-neutral-300 text-neutral-600 hover:border-teal-600 hover:text-teal-600 dark:border-neutral-700 dark:text-neutral-400'
              }`}
            >
              {s === 'all' ? 'All' : s === 'priced' ? 'Priced' : 'Needs conversion'}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-neutral-500">
          {sorted.length} of {rows.length} lines
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
                <SortableTh
                  label="Product"
                  active={sort.key === 'product'}
                  dir={sort.dir}
                  onClick={() => toggleSort('product')}
                />
                <th className="px-3 py-2">Category</th>
                <SortableTh
                  label="Vendor"
                  active={sort.key === 'vendor'}
                  dir={sort.dir}
                  onClick={() => toggleSort('vendor')}
                />
                <th className="px-3 py-2">Pack</th>
                <th className="px-3 py-2 text-right">Price</th>
                <SortableTh
                  label="$/kg"
                  active={sort.key === 'pricePerKg'}
                  dir={sort.dir}
                  onClick={() => toggleSort('pricePerKg')}
                  numeric
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-neutral-200 hover:bg-teal-50/60 dark:border-neutral-800 dark:hover:bg-teal-900/10"
                >
                  <td className="max-w-[220px] px-3 py-2 align-top">
                    <div className="font-medium">{row.productName}</div>
                    <div className="mt-0.5 max-w-[30ch] text-xs text-neutral-400">
                      {row.rawLabel}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] uppercase text-neutral-500 dark:border-neutral-700">
                      {row.category ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-xs">{row.vendorCode}</td>
                  <td className="px-3 py-2 align-top font-mono text-xs">
                    {row.qty}
                    {row.vendorUnit.toLowerCase()}
                  </td>
                  <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums">
                    {formatMoney(row.price)}
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    {row.needsConversionFactor ? (
                      <span
                        title="No avgWeightG set on this product yet — add one to products.json to convert this pack to $/kg."
                        className="inline-block cursor-help rounded-full bg-amber-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      >
                        needs wt.
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {formatMoney(row.pricePerDestinationUnit)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' }) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
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
