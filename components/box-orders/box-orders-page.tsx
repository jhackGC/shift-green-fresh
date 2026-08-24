'use client';

import type { BoxOrder } from 'lib/box-orders/types';
import { useState } from 'react';
import { toast } from 'sonner';

function formatMoney(n: number): string {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_STYLE: Record<BoxOrder['status'], string> = {
  new: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
  fulfilled:
    'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-900/20 dark:text-teal-300',
  cancelled:
    'border-neutral-300 bg-neutral-100 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'
};

export function BoxOrdersPage({
  initialOrders,
  itemNames
}: {
  initialOrders: BoxOrder[];
  /** Product display names, keyed by productId — resolved server-side. */
  itemNames: Record<string, string>;
}) {
  const [orders, setOrders] = useState(initialOrders);

  async function setStatus(id: string, status: BoxOrder['status']) {
    try {
      const res = await fetch('/api/box-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      const updated = (await res.json()) as BoxOrder;
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 pb-24 pt-6 md:px-6">
      <header className="border-b border-neutral-300 pb-4 dark:border-neutral-700">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Box reservations</h1>
        <p className="mt-1 max-w-[65ch] text-sm text-neutral-600 dark:text-neutral-400">
          Requests submitted from /boxes, swap choices included. Nothing here is paid yet — this is
          the "tell us what you want" list to action and confirm pickup for.
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-400">No reservations yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((order) => {
            const swapped = order.items.filter((i) => i.swappedForProductId);
            return (
              <div
                key={order.id}
                className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {order.boxName} — {formatMoney(order.price)}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">
                      {order.customerName} · {order.contact}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {new Date(order.createdAt).toLocaleString('en-AU')}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[order.status]}`}
                  >
                    {order.status}
                  </span>
                </div>

                {order.note && (
                  <p className="mt-2 text-sm italic text-neutral-500">&ldquo;{order.note}&rdquo;</p>
                )}

                {swapped.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-0.5 text-xs text-teal-700 dark:text-teal-300">
                    {swapped.map((i) => (
                      <li key={i.productId}>
                        swap: {itemNames[i.productId] ?? i.productId} →{' '}
                        {itemNames[i.swappedForProductId!] ?? i.swappedForProductId}
                      </li>
                    ))}
                  </ul>
                )}

                {order.status === 'new' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus(order.id, 'fulfilled')}
                      className="rounded-full bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700"
                    >
                      Mark fulfilled
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(order.id, 'cancelled')}
                      className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
