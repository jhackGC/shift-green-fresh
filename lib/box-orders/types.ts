/**
 * A customer's reservation of a box, including which swap-pool alternatives they picked. This is
 * a request to be actioned, not a paid order — there's no checkout/payment wired up yet, so this
 * is the lightweight "tell us what you want" capture that closes the loop on box swapping: a
 * customer can pick alternatives on /boxes, but that choice is meaningless unless it lands
 * somewhere the business actually sees.
 */

export type BoxOrderItem = {
  /** The box's own item slot, as originally composed. */
  productId: string;
  qty: number;
  /** Set only if the customer swapped this slot — the alternative productId they chose instead,
   *  at the same qty. Omitted means they kept the original. */
  swappedForProductId?: string;
};

export type BoxOrder = {
  id: string;
  boxId: string;
  /** Snapshot at request time — the box itself can be edited or removed later, but this is what
   *  the customer actually saw and agreed to. */
  boxName: string;
  price: number;
  items: BoxOrderItem[];
  customerName: string;
  /** Required — the order-notification email is sent to the business owner, but a real address on
   *  file is also what makes replying to the customer directly (via `replyTo`) possible at all. */
  email: string;
  /** Optional — pickup coordination for a small local operation is often a phone call, but not
   *  everyone wants to give a number. */
  phone?: string;
  note?: string;
  status: 'new' | 'fulfilled' | 'cancelled';
  createdAt: string;
};
