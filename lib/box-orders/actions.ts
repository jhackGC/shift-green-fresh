'use server';

import { loadBoxes } from 'lib/boxes/store';
import { addBoxOrder, updateBoxOrderStatus } from 'lib/box-orders/store';
import type { BoxOrder, BoxOrderItem } from 'lib/box-orders/types';
import { escapeHtml, sendMail } from 'lib/mail/send';
import { loadProducts } from 'lib/vendor-pricing/store';
import { revalidatePath } from 'next/cache';

export type CreateBoxOrderInput = {
  boxId: string;
  swaps?: { productId: string; swappedForProductId: string }[];
  customerName: string;
  email: string;
  phone?: string;
  note?: string;
};

function formatMoney(n: number): string {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Builds the order-notification email body — same level of detail already shown on
 *  /admin/box-orders, just pushed to the owner's inbox instead of waiting to be checked. */
function orderNotificationEmail(
  order: BoxOrder,
  nameById: Map<string, string>
): {
  subject: string;
  text: string;
  html: string;
} {
  const itemLines = order.items.map((item) => {
    const original = nameById.get(item.productId) ?? item.productId;
    return item.swappedForProductId
      ? `${original} → ${nameById.get(item.swappedForProductId) ?? item.swappedForProductId}`
      : original;
  });

  const subject = `New box reservation: ${order.boxName}`;
  const text = [
    `${order.boxName} — ${formatMoney(order.price)}`,
    '',
    `Name: ${order.customerName}`,
    `Email: ${order.email}`,
    ...(order.phone ? [`Phone: ${order.phone}`] : []),
    ...(order.note ? ['', `Note: ${order.note}`] : []),
    '',
    'Items:',
    ...itemLines.map((line) => `- ${line}`)
  ].join('\n');

  const html = [
    `<p><strong>${escapeHtml(order.boxName)}</strong> — ${formatMoney(order.price)}</p>`,
    `<p><strong>Name:</strong> ${escapeHtml(order.customerName)}<br>`,
    `<strong>Email:</strong> ${escapeHtml(order.email)}<br>`,
    ...(order.phone ? [`<strong>Phone:</strong> ${escapeHtml(order.phone)}<br>`] : []),
    `</p>`,
    ...(order.note ? [`<p><strong>Note:</strong> ${escapeHtml(order.note)}</p>`] : []),
    '<p><strong>Items:</strong></p>',
    '<ul>',
    ...itemLines.map((line) => `<li>${escapeHtml(line)}</li>`),
    '</ul>'
  ].join('');

  return { subject, text, html };
}

/**
 * Records a customer's box reservation, swap choices included, then emails the business owner a
 * notification. Price and item list are never trusted from the client — both are rebuilt
 * server-side from the box as it's actually saved right now, and each swap is checked against
 * that item's own curated swapOptions pool rather than accepted as-is (the whole point of a pool
 * is that not just anything is swappable in).
 *
 * A failed/unconfigured email doesn't fail the reservation — by the time the send is attempted the
 * order is already saved, and /admin/box-orders stays the source of truth either way.
 */
export async function createBoxOrder(input: CreateBoxOrderInput): Promise<BoxOrder> {
  const { boxId, swaps, customerName, email, phone, note } = input;

  if (!boxId || !customerName?.trim() || !email?.trim()) {
    throw new Error('A box, name, and email are needed to reserve.');
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
    email: email.trim(),
    ...(phone?.trim() ? { phone: phone.trim() } : {}),
    ...(note?.trim() ? { note: note.trim() } : {}),
    status: 'new',
    createdAt: new Date().toISOString()
  };
  addBoxOrder(order);
  revalidatePath('/admin/box-orders');

  const nameById = new Map(loadProducts().map((p) => [p.id, p.name]));
  const { subject, text, html } = orderNotificationEmail(order, nameById);
  const result = await sendMail({ subject, text, html, replyTo: order.email });
  if (!result.sent) {
    // The reservation is already saved — /admin/box-orders is still the source of truth if the
    // notification doesn't make it, so this is a log, not a thrown error.
    console.warn(`Order ${order.id} saved, but notification email failed: ${result.reason}`);
  }

  return order;
}

export async function setBoxOrderStatus(id: string, status: BoxOrder['status']): Promise<BoxOrder> {
  const updated = updateBoxOrderStatus(id, status);
  revalidatePath('/admin/box-orders');
  return updated;
}
