'use client';

import { priceForMargin } from 'lib/margins/calc';
import { betterProcurement, planProcurement, type PackOption } from 'lib/boxes/procurement';
import type { Box, BoxItem } from 'lib/boxes/types';
import type { Product } from 'lib/vendor-pricing/types';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';

export type AvailableItem = {
  productId: string;
  name: string;
  category?: Product['category'];
  pricePerKg: number;
  packOptions: PackOption[];
};

function formatMoney(n: number): string {
  if (Number.isNaN(n)) return '—';
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BoxBuilder({
  vendorCode,
  weekOf,
  availableItems,
  initialBoxes
}: {
  vendorCode: string;
  weekOf: string;
  availableItems: AvailableItem[];
  initialBoxes: Box[];
}) {
  const [boxes, setBoxes] = useState(initialBoxes);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [marginPercent, setMarginPercent] = useState(35);
  const [draftItems, setDraftItems] = useState<BoxItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [boxCount, setBoxCount] = useState<number | ''>('');
  const [researchedRrp, setResearchedRrp] = useState<number | ''>('');
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);

  const itemByProductId = useMemo(
    () => new Map(availableItems.map((i) => [i.productId, i])),
    [availableItems]
  );

  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableItems;
    return availableItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [availableItems, search]);

  // Naive cost: exact kg needed at the cheapest listed $/kg — ignores that wholesale only sells
  // in fixed pack sizes. Always shown, since it's the floor a real order can never beat.
  const naiveCost = useMemo(
    () =>
      draftItems.reduce(
        (sum, item) => sum + item.qty * (itemByProductId.get(item.productId)?.pricePerKg ?? 0),
        0
      ),
    [draftItems, itemByProductId]
  );

  // Pack-aware cost: only computable once we know how many boxes we're actually procuring for.
  const procurement = useMemo(() => {
    if (typeof boxCount !== 'number' || boxCount <= 0) return null;
    return draftItems.map((item) => {
      const info = itemByProductId.get(item.productId);
      const demandKg = item.qty * boxCount;
      const plan = info ? planProcurement(demandKg, info.packOptions) : null;
      const chosen = plan ? betterProcurement(plan) : null;
      return { item, info, demandKg, plan, chosen };
    });
  }, [draftItems, itemByProductId, boxCount]);

  const realCostPerBox = useMemo(() => {
    if (!procurement || typeof boxCount !== 'number' || boxCount <= 0) return null;
    const total = procurement.reduce(
      (sum, p) => sum + (p.chosen?.totalCost ?? p.item.qty * boxCount * (p.info?.pricePerKg ?? 0)),
      0
    );
    return total / boxCount;
  }, [procurement, boxCount]);

  const effectiveCost = realCostPerBox ?? naiveCost;
  const formulaSellPrice = Math.round(priceForMargin(effectiveCost, marginPercent));
  const sellPrice =
    typeof researchedRrp === 'number' && researchedRrp > 0 ? researchedRrp : formulaSellPrice;
  const totalWeight = draftItems.reduce((sum, item) => sum + item.qty, 0);

  function addItem(productId: string) {
    setDraftItems((prev) =>
      prev.some((i) => i.productId === productId) ? prev : [...prev, { productId, qty: 0.5 }]
    );
  }
  function updateQty(productId: string, qty: number) {
    setDraftItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty } : i)));
  }
  function removeItem(productId: string) {
    setDraftItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function saveBox() {
    if (!name.trim() || draftItems.length === 0) {
      toast.error('Give the box a name and at least one item first.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          weekOf,
          vendorCode,
          marginPercent,
          items: draftItems,
          boxCount: typeof boxCount === 'number' ? boxCount : undefined,
          researchedRrp: typeof researchedRrp === 'number' ? researchedRrp : undefined
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      const box = (await res.json()) as Box;
      setBoxes((prev) => [...prev, box]);
      setName('');
      setDescription('');
      setDraftItems([]);
      setBoxCount('');
      setResearchedRrp('');
      toast.success(`Saved "${box.name}" — ${formatMoney(box.sellPrice)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function removeBox(id: string) {
    try {
      const res = await fetch('/api/boxes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setBoxes((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function saveDescription(id: string, value: string) {
    try {
      const res = await fetch('/api/boxes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, description: value })
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const updated = (await res.json()) as Box;
      setBoxes((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 pb-24 pt-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-300 pb-4 dark:border-neutral-700">
        <div className="max-w-[62ch]">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Weekly Boxes</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Compose a box from this week's {vendorCode} availability ({weekOf || 'no import yet'}
            ). Cost and sell price are computed from real wholesale pricing — nothing here is
            invented.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Available items */}
        <div className="rounded-lg border border-neutral-300 dark:border-neutral-700">
          <div className="border-b border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
            <input
              type="text"
              placeholder="Search this week's available produce…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {filteredAvailable.map((item) => {
                  const inBox = draftItems.some((i) => i.productId === item.productId);
                  return (
                    <tr
                      key={item.productId}
                      className="border-b border-neutral-200 hover:bg-teal-50/60 dark:border-neutral-800 dark:hover:bg-teal-900/10"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{item.name}</div>
                        <span className="rounded-full border border-neutral-300 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500 dark:border-neutral-700">
                          {item.category ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-neutral-500">
                        {formatMoney(item.pricePerKg)}/kg
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={inBox}
                          onClick={() => addItem(item.productId)}
                          className="rounded-full border border-teal-600 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:cursor-default disabled:border-neutral-300 disabled:text-neutral-400 dark:border-teal-400 dark:text-teal-300 dark:hover:bg-teal-900/20 dark:disabled:border-neutral-700 dark:disabled:text-neutral-600"
                        >
                          {inBox ? 'In box' : '+ Add'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Draft box */}
        <div className="flex flex-col gap-4 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
          <input
            type="text"
            placeholder="Box name, e.g. Small Mixed Veg Box"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
          <input
            type="text"
            placeholder="Who's this for? e.g. Family of 4, full week of cooking"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />

          <label className="flex items-center justify-between text-xs text-neutral-500">
            Target margin
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={95}
                value={marginPercent}
                onChange={(e) => setMarginPercent(Number(e.target.value) || 0)}
                className="w-14 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-right font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
              %
            </span>
          </label>

          <label className="flex items-center justify-between text-xs text-neutral-500">
            Boxes to sell (estimate)
            <input
              type="number"
              min={1}
              placeholder="—"
              value={boxCount}
              onChange={(e) => setBoxCount(e.target.value ? Number(e.target.value) : '')}
              className="w-14 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-right font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </label>
          {typeof boxCount !== 'number' && (
            <p className="-mt-2 text-[11px] text-neutral-400">
              Without this, cost assumes exact kg at the cheapest $/kg — pack sizes (15kg boxes
              etc.) aren't accounted for. Set it to see real procurement cost.
            </p>
          )}

          <label className="flex items-center justify-between text-xs text-neutral-500">
            Researched RRP (optional)
            <span className="flex items-center gap-1">
              $
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder="formula"
                value={researchedRrp}
                onChange={(e) => setResearchedRrp(e.target.value ? Number(e.target.value) : '')}
                className="w-16 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-right font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </span>
          </label>

          <div className="flex flex-col gap-2">
            {draftItems.length === 0 && (
              <p className="text-xs text-neutral-400">Add items from the list on the left.</p>
            )}
            {draftItems.map((item) => {
              const info = itemByProductId.get(item.productId);
              const p = procurement?.find((x) => x.item.productId === item.productId);
              return (
                <div key={item.productId} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{info?.name ?? item.productId}</span>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={item.qty}
                      onChange={(e) => updateQty(item.productId, Number(e.target.value) || 0)}
                      className="w-14 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-right font-mono dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                    <span className="text-neutral-400">kg</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-neutral-400 hover:text-red-600"
                      aria-label={`Remove ${info?.name ?? item.productId}`}
                    >
                      &times;
                    </button>
                  </div>
                  {p?.chosen && (
                    <div className="pl-1 text-[10px] text-neutral-400">
                      {p.demandKg.toFixed(1)}kg needed →{' '}
                      {p.chosen.strategy === 'whole-packs'
                        ? `${p.chosen.packsBought}× ${p.chosen.packQty}kg pack${p.chosen.packsBought > 1 ? 's' : ''} (${p.chosen.surplusKg.toFixed(1)}kg surplus)`
                        : `${p.chosen.packsBought}× ${p.chosen.packQty}kg pack${p.chosen.packsBought !== 1 ? 's' : ''} + ${p.chosen.splitKg?.toFixed(1)}kg split (+20% fee, no surplus)`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1 rounded border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex justify-between">
              <span className="text-neutral-500">Total weight</span>
              <span className="font-mono">{totalWeight.toFixed(1)}kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Naive cost (exact kg)</span>
              <span className="font-mono">{formatMoney(naiveCost)}</span>
            </div>
            {realCostPerBox != null && (
              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>Real cost (pack-aware)</span>
                <span className="font-mono">{formatMoney(realCostPerBox)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold">
              <span>Sell price {researchedRrp ? '(RRP)' : '(formula, rounded)'}</span>
              <span className="font-mono text-teal-700 dark:text-teal-300">
                {formatMoney(sellPrice)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={saveBox}
            disabled={saving || draftItems.length === 0}
            className="rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Save box
          </button>
        </div>
      </div>

      {/* Saved boxes */}
      <div className="rounded-lg border border-neutral-300 dark:border-neutral-700">
        <div className="border-b border-neutral-300 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Saved boxes — {boxes.length}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Box</th>
                <th className="px-3 py-2">Week</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2 text-right">Weight</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Sell</th>
                <th className="px-3 py-2 text-right">Margin</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {boxes.map((box) => {
                const boxWeight = box.items.reduce((sum, item) => sum + item.qty, 0);
                const expanded = expandedBoxId === box.id;
                return (
                  <Fragment key={box.id}>
                    <tr className="border-b border-neutral-200 hover:bg-teal-50/60 dark:border-neutral-800 dark:hover:bg-teal-900/10">
                      <td className="px-3 py-2 align-top">
                        <button
                          type="button"
                          onClick={() => setExpandedBoxId(expanded ? null : box.id)}
                          aria-label={expanded ? 'Collapse' : 'Expand'}
                          className="text-neutral-400 hover:text-teal-600 dark:hover:text-teal-400"
                        >
                          {expanded ? '▾' : '▸'}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {box.name}
                        <input
                          type="text"
                          defaultValue={box.description ?? ''}
                          placeholder="Who's this for? (click to add guidance)"
                          onBlur={(e) => {
                            if (e.target.value !== (box.description ?? ''))
                              saveDescription(box.id, e.target.value);
                          }}
                          className="mt-0.5 block w-full rounded border-none bg-transparent px-0 py-0 text-[11px] font-normal text-neutral-500 placeholder:text-neutral-400 focus:border focus:border-neutral-300 focus:bg-white focus:px-1.5 focus:py-0.5 dark:text-neutral-400 dark:placeholder:text-neutral-600 dark:focus:border-neutral-700 dark:focus:bg-neutral-800"
                        />
                        {box.boxCount && (
                          <div className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                            pack-aware @ {box.boxCount} boxes
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-500">{box.weekOf}</td>
                      <td className="px-3 py-2 text-xs text-neutral-500">
                        {box.items.length} items
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {boxWeight.toFixed(1)}kg
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {formatMoney(box.wholesaleCost)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-semibold">
                        {formatMoney(box.sellPrice)}
                        {box.researchedRrp && (
                          <div className="text-[10px] font-normal text-neutral-400">RRP</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {box.marginPercent}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeBox(box.id)}
                          className="text-xs text-neutral-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
                        <td />
                        <td colSpan={8} className="px-3 py-3">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                            {box.items.map((item) => (
                              <div
                                key={item.productId}
                                className="flex justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400"
                              >
                                <span className="truncate">
                                  {itemByProductId.get(item.productId)?.name ?? item.productId}
                                </span>
                                <span className="font-mono text-neutral-400">{item.qty}kg</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
