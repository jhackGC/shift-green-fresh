'use client';

import { createNonPerishable, removeNonPerishable } from 'lib/non-perishables/actions';
import type { NonPerishableItem } from 'lib/non-perishables/types';
import { useState } from 'react';
import { toast } from 'sonner';

function formatMoney(n: number): string {
  if (Number.isNaN(n)) return '—';
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function NonPerishablesPage({ initialItems }: { initialItems: NonPerishableItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState<number | ''>('');
  const [sellPrice, setSellPrice] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const draftMargin =
    typeof cost === 'number' && typeof sellPrice === 'number' && sellPrice > 0
      ? ((sellPrice - cost) / sellPrice) * 100
      : null;

  async function addItem() {
    if (!name.trim() || typeof cost !== 'number' || typeof sellPrice !== 'number') {
      toast.error('Name, cost, and sell price are all required.');
      return;
    }
    setSaving(true);
    try {
      const item = await createNonPerishable({
        name,
        category: category || undefined,
        cost,
        sellPrice
      });
      setItems((prev) => [...prev, item]);
      setName('');
      setCategory('');
      setCost('');
      setSellPrice('');
      toast.success(`Added "${item.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    try {
      await removeNonPerishable(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6 px-4 pb-24 pt-6 md:px-6">
      <header className="border-b border-neutral-300 pb-4 dark:border-neutral-700">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Non-Perishables</h1>
        <p className="mt-1 max-w-[65ch] text-sm text-neutral-600 dark:text-neutral-400">
          Shelf-stable items with no spoilage clock and typically much fatter margins than fresh
          produce — honey, preserves, dried goods, eggs, oils. A different supply chain from
          eco-farms, so cost/price are entered by hand, not imported. These feed into the Business
          Model page's weekly P&amp;L alongside your box mix.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Local Honey 500g"
            className="w-48 rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Category
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="optional"
            className="w-32 rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Cost
          <input
            type="number"
            min={0}
            step={0.1}
            value={cost}
            onChange={(e) => setCost(e.target.value ? Number(e.target.value) : '')}
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-right font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Sell price
          <input
            type="number"
            min={0}
            step={0.1}
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value ? Number(e.target.value) : '')}
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-right font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </label>
        <span className="pb-1.5 font-mono text-sm text-neutral-500">
          {draftMargin != null ? `${draftMargin.toFixed(0)}% margin` : ''}
        </span>
        <button
          type="button"
          onClick={addItem}
          disabled={saving}
          className="rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <div className="rounded-lg border border-neutral-300 dark:border-neutral-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-right">Sell</th>
              <th className="px-3 py-2 text-right">Margin</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-neutral-400">
                  No items yet — add one above.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const margin =
                item.sellPrice > 0 ? ((item.sellPrice - item.cost) / item.sellPrice) * 100 : 0;
              return (
                <tr key={item.id} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{item.category ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {formatMoney(item.cost)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {formatMoney(item.sellPrice)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {margin.toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-neutral-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
