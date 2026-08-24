'use client';

import { marginTier } from 'lib/margins/calc';
import { resolvePendingRetailPriceChange, updateRetailPrice } from 'lib/retail-pricing/actions';
import type { PendingRetailChange, RetailPricing } from 'lib/retail-pricing/types';
import type { Product } from 'lib/vendor-pricing/types';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

export type JoinedRetailRow = RetailPricing & {
  productName: string;
  category?: Product['category'];
  /** Cheapest known wholesale $/kg for this product, across every vendor — null if no vendor has
   *  a priced (kg-known) line for it yet. */
  wholesalePricePerKg: number | null;
  wholesaleVendorCode?: string;
};

export type JoinedPendingChange = PendingRetailChange & { productName: string };

type SortKey = 'product' | 'pricePerKg' | 'margin';
type SortState = { key: SortKey | null; dir: 1 | -1 };
type StatusFilter = 'all' | 'priced' | 'needsConversion' | 'verify';

const TIER_CLASSES: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  bad: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
};

/** retail $/kg vs the cheapest known wholesale $/kg for the same product — null if either side
 *  isn't known yet (needs a conversion factor, no vendor price, etc.). */
function computeMargin(row: JoinedRetailRow): { dollar: number; percent: number } | null {
  if (row.pricePerDestinationUnit == null || row.wholesalePricePerKg == null) return null;
  const dollar = row.pricePerDestinationUnit - row.wholesalePricePerKg;
  const percent =
    row.pricePerDestinationUnit !== 0 ? (dollar / row.pricePerDestinationUnit) * 100 : NaN;
  return { dollar, percent };
}

function formatMoney(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RetailPricingTable({
  rows: initialRows,
  pending: initialPending
}: {
  rows: JoinedRetailRow[];
  pending: JoinedPendingChange[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [pending, setPending] = useState(initialPending);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortState>({ key: 'product', dir: 1 });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const summary = useMemo(() => {
    let priced = 0;
    let needsConversion = 0;
    let verify = 0;
    rows.forEach((r) => {
      if (r.needsConversionFactor) needsConversion++;
      else priced++;
      if (r.confidence === 'verify') verify++;
    });
    return { priced, needsConversion, verify, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === 'priced' && r.needsConversionFactor) return false;
      if (status === 'needsConversion' && !r.needsConversionFactor) return false;
      if (status === 'verify' && r.confidence !== 'verify') return false;
      if (!q) return true;
      return r.productName.toLowerCase().includes(q) || r.rawLabel.toLowerCase().includes(q);
    });
  }, [rows, search, status]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const copy = [...filtered];
    const sortValue = (row: JoinedRetailRow): number | string => {
      if (sort.key === 'product') return row.productName.toLowerCase();
      if (sort.key === 'margin') return computeMargin(row)?.percent ?? -Infinity;
      return row.pricePerDestinationUnit ?? -Infinity;
    };
    copy.sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
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

  async function savePrice(row: JoinedRetailRow, price: number) {
    setSavingId(row.id);
    try {
      const updated = await updateRetailPrice(row.id, row.retailerCode, price);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      toast.success(`Saved ${row.productName} — ${formatMoney(price)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  }

  async function resolvePending(change: JoinedPendingChange, action: 'approve' | 'reject') {
    setResolvingId(change.id);
    try {
      const { updated } = await resolvePendingRetailPriceChange(
        change.id,
        change.retailerCode,
        action
      );
      setPending((prev) => prev.filter((p) => p.id !== change.id));
      if (action === 'approve' && updated) {
        setRows((prev) => prev.map((r) => (r.id === change.id ? { ...r, ...updated } : r)));
        toast.success(`Approved ${change.productName} — ${formatMoney(change.proposedPrice)}`);
      } else {
        toast(`Rejected — kept ${change.productName} at ${formatMoney(change.currentPrice)}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 pb-24 pt-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-300 pb-4 dark:border-neutral-700">
        <div className="max-w-[62ch]">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Retail Pricing</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Fresh Organic Merrimac board, transcribed and matched against the wholesale product
            catalog. Editing a price here saves it straight to disk — no need to touch the JSON or
            ask me to re-run the import.
          </p>
        </div>
      </header>

      {pending.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Pending changes from a re-ingest — {pending.length}
          </h2>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            A re-import found a different price than what's currently live. Nothing below has been
            applied yet — approve to override the current value, reject to keep it.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {pending.map((change) => (
              <div
                key={change.id}
                className="flex flex-wrap items-center gap-3 rounded border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900 dark:bg-neutral-900"
              >
                <span className="min-w-[160px] font-medium">{change.productName}</span>
                <span className="text-xs text-neutral-400">{change.rawLabel}</span>
                <span className="ml-auto font-mono text-xs">
                  <span className="text-neutral-400 line-through">
                    {formatMoney(change.currentPrice)}
                  </span>
                  {' → '}
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    {formatMoney(change.proposedPrice)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={resolvingId === change.id}
                  onClick={() => resolvePending(change, 'approve')}
                  className="rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={resolvingId === change.id}
                  onClick={() => resolvePending(change, 'reject')}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:border-red-500 hover:text-red-600 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400"
                >
                  Reject
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rows" value={summary.total} />
        <Stat label="Priced ($/kg known)" value={summary.priced} tone="good" />
        <Stat label="Needs conversion factor" value={summary.needsConversion} tone="warn" />
        <Stat label="Flagged for review" value={summary.verify} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
        <input
          type="text"
          placeholder="Search product or board label…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
        <div className="flex gap-1 text-xs">
          {(['all', 'priced', 'needsConversion', 'verify'] as StatusFilter[]).map((s) => (
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
              {s === 'all'
                ? 'All'
                : s === 'priced'
                  ? 'Priced'
                  : s === 'needsConversion'
                    ? 'Needs conversion'
                    : 'Flagged'}
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
                <th className="px-3 py-2">Board label</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">Price</th>
                <SortableTh
                  label="$/kg"
                  active={sort.key === 'pricePerKg'}
                  dir={sort.dir}
                  onClick={() => toggleSort('pricePerKg')}
                  numeric
                />
                <th className="px-3 py-2 text-right">Wholesale $/kg</th>
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
              {sorted.map((row) => (
                <RowEditor
                  key={row.id}
                  row={row}
                  saving={savingId === row.id}
                  onSave={(price) => savePrice(row, price)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RowEditor({
  row,
  saving,
  onSave
}: {
  row: JoinedRetailRow;
  saving: boolean;
  onSave: (price: number) => void;
}) {
  const [draft, setDraft] = useState(String(row.price));
  const margin = computeMargin(row);

  function commit() {
    const price = Number(draft);
    if (!Number.isFinite(price) || price < 0) {
      setDraft(String(row.price));
      return;
    }
    if (price === row.price) return;
    onSave(price);
  }

  return (
    <tr className="border-b border-neutral-200 hover:bg-teal-50/60 dark:border-neutral-800 dark:hover:bg-teal-900/10">
      <td className="max-w-[220px] px-3 py-2 align-top">
        <div className="font-medium">
          {row.productName}{' '}
          {row.confidence === 'verify' && (
            <span
              title={row.note}
              className="cursor-help font-bold text-amber-600 dark:text-amber-400"
            >
              &#9873;
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] uppercase text-neutral-500 dark:border-neutral-700">
          {row.category ?? '—'}
        </span>
      </td>
      <td className="max-w-[180px] px-3 py-2 align-top text-xs text-neutral-500">{row.rawLabel}</td>
      <td className="px-3 py-2 align-top font-mono text-xs">
        {row.qty}
        {row.retailUnit.toLowerCase()}
      </td>
      <td className="px-3 py-2 text-right align-top">
        <div className="flex items-center justify-end gap-1 font-mono text-xs">
          $
          <input
            type="number"
            min={0}
            step={0.1}
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-16 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-right font-mono text-xs text-black disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>
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
      <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums">
        {row.wholesalePricePerKg != null ? (
          <>
            {formatMoney(row.wholesalePricePerKg)}
            {row.wholesaleVendorCode && (
              <div className="mt-0.5 text-[10px] normal-case text-neutral-400">
                {row.wholesaleVendorCode}
              </div>
            )}
          </>
        ) : (
          <span className="text-neutral-300 dark:text-neutral-600">&mdash;</span>
        )}
      </td>
      <td className="px-3 py-2 text-right align-top">
        {margin ? (
          <>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${TIER_CLASSES[marginTier(margin.percent)]}`}
            >
              {Number.isNaN(margin.percent)
                ? '—'
                : `${margin.percent >= 0 ? '+' : ''}${margin.percent.toFixed(0)}%`}
            </span>
            <div className="mt-1 font-mono text-xs text-neutral-400">
              {formatMoney(margin.dollar)}
            </div>
          </>
        ) : (
          <span className="text-neutral-300 dark:text-neutral-600">&mdash;</span>
        )}
      </td>
    </tr>
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
