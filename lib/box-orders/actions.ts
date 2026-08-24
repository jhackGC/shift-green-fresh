'use server';

import { loadBoxes } from 'lib/boxes/store';
import { addBoxOrder, updateBoxOrderStatus } from 'lib/box-orders/store';
import type { BoxOrder, BoxOrderItem } from 'lib/box-orders/types';
import { revalidatePath } from 'next/cache';

export type CreateBoxOrderInput = {
  boxId: string;
  swaps?: { productId: string; swappedForProductId: string }[];
  customerName: string;
  contact: string;
  note?: string;
};

/**
 * Records a customer's box reservation, swap choices included.
 *
 * Price and item list are never trusted from the client — both are rebuilt server-side from the
 * box as it's actually saved right now, and each swap is checked against that item's own curated
 * swapOptions pool rather than accepted as-is (the whole point of a pool is that not just
 * anything is swappable in).
 */
export async function createBoxOrder(input: CreateBoxOrderInput): Promise<BoxOrder> {
  const { boxId, swaps, customerName, contact, note } = input;

  if (!boxId || !customerName?.trim() || !contact?.trim()) {
    throw new Error('A box, name, and phone or email are needed to reserve.');
  }

  const box = loadBoxes().find((b) => b.id === boxId);
  if (!box) {
    throw new Error(`No box "${boxId}" found.`);
  }

  const swapByProductId = new Map(
    (swaps ?? [])
      .filter((s): s is { productId: string; swappedForProductId: string } =>
        Boolean(s.productId && s.swappedForProductId)
      )
      .map((s) => [s.productId, s.swappedForProductId])
  );

  const items: BoxOrderItem[] = box.items.map((item) => {
    const requested = swapByProductId.get(item.productId);
    const isValidSwap = requested != null && (item.swapOptions ?? []).includes(requested);
    return {
      productId: item.productId,
      qty: item.qty,
      ...(isValidSwap ? { swappedForProductId: requested } : {})
    };
  });

  const order: BoxOrder = {
    id: `box-order-${Date.now()}`,
    boxId: box.id,
    boxName: box.name,
    price: box.sellPrice,
    items,
    customerName: customerName.trim(),
    contact: contact.trim(),
    ...(note?.trim() ? { note: note.trim() } : {}),
    status: 'new',
    createdAt: new Date().toISOString()
  };
  addBoxOrder(order);
  revalidatePath('/admin/box-orders');
  return order;
}

export async function setBoxOrderStatus(id: string, status: BoxOrder['status']): Promise<BoxOrder> {
  const updated = updateBoxOrderStatus(id, status);
  revalidatePath('/admin/box-orders');
  return updated;
}
