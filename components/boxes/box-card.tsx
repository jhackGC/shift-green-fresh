'use client';

import { boxPricePerKg, boxTotalKg } from 'lib/boxes/calc';
import type { Box } from 'lib/boxes/types';
import { useState } from 'react';
import { toast } from 'sonner';

function formatKg(kg: number): string {
  return kg < 1 ? `${Math.round(kg * 1000)}g` : `${kg.toFixed(kg % 1 === 0 ? 0 : 1)}kg`;
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BoxCard({
  box,
  itemNames
}: {
  box: Box;
  /** Display names for every productId this box can reference — its own items and every item in
   *  every swap pool — keyed by productId, resolved server-side since the client only ever sees
   *  ids. */
  itemNames: Record<string, string>;
}) {
  // Keyed by the item's original productId → the alternative chosen, or undefined to keep the
  // original. Local only until "Reserve" is pressed — nothing is sent until then.
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [reserving, setReserving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');

  const totalKg = boxTotalKg(box);
  const pricePerKg = boxPricePerKg(box);

  function chooseSwap(productId: string, swapId: string) {
    setSwaps((prev) => {
      const next = { ...prev };
      if (!swapId) delete next[productId];
      else next[productId] = swapId;
      return next;
    });
  }

  async function reserve() {
    if (!customerName.trim() || !contact.trim()) {
      toast.error('Name and a phone or email are needed to reserve a box.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/box-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boxId: box.id,
          swaps: Object.entries(swaps).map(([productId, swappedForProductId]) => ({
            productId,
            swappedForProductId
          })),
          customerName,
          contact,
          note: note || undefined
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Reservation failed (${res.status})`);
      }
      setSubmitted(true);
      toast.success(`Reserved "${box.name}" — we'll be in touch to confirm pickup.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reservation failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="flex flex-col rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-lg font-semibold">{box.name}</h2>
      {box.description && (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{box.description}</p>
      )}

      <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-sm">
        {box.items.map((item) => {
          const hasSwaps = (item.swapOptions?.length ?? 0) > 0;
          const chosen = swaps[item.productId];
          return (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-3 border-b border-dashed border-neutral-200 py-1 dark:border-neutral-800"
            >
              {hasSwaps ? (
                <select
                  value={chosen ?? item.productId}
                  onChange={(e) => chooseSwap(item.productId, e.target.value)}
                  className="flex-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                >
                  <option value={item.productId}>
                    {itemNames[item.productId] ?? item.productId}
                  </option>
                  {item.swapOptions!.map((swapId) => (
                    <option key={swapId} value={swapId}>
                      {itemNames[swapId] ?? swapId} (swap)
                    </option>
                  ))}
                </select>
              ) : (
                <span>{itemNames[item.productId] ?? item.productId}</span>
              )}
              <span className="whitespace-nowrap font-mono text-xs text-neutral-500 dark:text-neutral-400">
                {formatKg(item.qty)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">{formatMoney(box.sellPrice)}</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {formatKg(totalKg)} total
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {formatMoney(pricePerKg)}/kg — certified organic, picked up in Varsity Lakes. Price
          doesn&rsquo;t change if you swap.
        </p>
      </div>

      {submitted ? (
        <p className="mt-4 rounded border border-teal-300 bg-teal-50 px-3 py-2 text-xs text-teal-700 dark:border-teal-800 dark:bg-teal-900/20 dark:text-teal-300">
          Reserved. We&rsquo;ll confirm your pickup time by phone or email.
        </p>
      ) : reserving ? (
        <div className="mt-4 flex flex-col gap-2">
          <input
            type="text"
            placeholder="Your name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
          <input
            type="text"
            placeholder="Phone or email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reserve}
              disabled={submitting}
              className="flex-1 rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? 'Reserving…' : 'Confirm reservation'}
            </button>
            <button
              type="button"
              onClick={() => setReserving(false)}
              disabled={submitting}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setReserving(true)}
          className="mt-4 rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
        >
          Reserve this box
        </button>
      )}
    </article>
  );
}
