'use server';

import { betterProcurement, planProcurement } from 'lib/boxes/procurement';
import { addBox, deleteBox as deleteBoxRecord, updateBoxDescription } from 'lib/boxes/store';
import type { Box, BoxItem } from 'lib/boxes/types';
import { priceForMargin } from 'lib/margins/calc';
import { loadAllLatestVendorPricing, loadProducts } from 'lib/vendor-pricing/store';
import { revalidatePath } from 'next/cache';

export type SaveBoxInput = {
  name: string;
  description?: string;
  weekOf: string;
  vendorCode: string;
  marginPercent: number;
  items: BoxItem[];
  boxCount?: number;
  researchedRrp?: number;
};

/**
 * Saves a new box. Cost/sell price are computed server-side from that week's actual wholesale
 * pricing, never trusted from the client, so a saved box always reflects real numbers.
 * `swapOptions` per item is trusted for *which* alternatives were curated, but filtered to ones
 * this week's import can actually price.
 *
 * When `boxCount` is given, cost is pack-rounding-aware: for each item, total demand across all
 * boxes is procured as whole packs or (eco-farms' own 20% handling fee) a split pack, whichever is
 * cheaper, then divided back down to a per-box cost — a more honest number than assuming you can
 * buy the exact fractional kg needed at the cheapest listed $/kg.
 */
export async function saveBox(input: SaveBoxInput): Promise<Box> {
  const { name, description, weekOf, vendorCode, marginPercent, items, boxCount, researchedRrp } =
    input;

  if (
    !name ||
    !weekOf ||
    !vendorCode ||
    typeof marginPercent !== 'number' ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error(
      'Expected a name, week, vendor, margin, and at least one item: { productId, qty }.'
    );
  }

  const products = loadProducts();
  const productById = new Map(products.map((p) => [p.id, p]));
  const vendorRows = loadAllLatestVendorPricing().filter((v) => v.vendorCode === vendorCode);

  const cheapestByProduct = new Map<string, number>();
  const packOptionsByProduct = new Map<string, { qty: number; price: number }[]>();
  for (const v of vendorRows) {
    if (v.pricePerDestinationUnit == null) continue;
    const existing = cheapestByProduct.get(v.productId);
    if (existing == null || v.pricePerDestinationUnit < existing) {
      cheapestByProduct.set(v.productId, v.pricePerDestinationUnit);
    }
    const packs = packOptionsByProduct.get(v.productId) ?? [];
    packs.push({ qty: v.qty, price: v.price });
    packOptionsByProduct.set(v.productId, packs);
  }

  let wholesaleCost = 0;
  const usePackRounding = typeof boxCount === 'number' && boxCount > 0;

  for (const item of items) {
    const pricePerKg = cheapestByProduct.get(item.productId);
    if (pricePerKg == null) {
      const label = productById.get(item.productId)?.name ?? item.productId;
      throw new Error(
        `No priced ${vendorCode} line for "${label}" this week — remove it or wait for a fresh import.`
      );
    }

    if (usePackRounding) {
      const demandKg = item.qty * boxCount!;
      const plan = planProcurement(demandKg, packOptionsByProduct.get(item.productId) ?? []);
      wholesaleCost += plan ? betterProcurement(plan).totalCost / boxCount! : pricePerKg * item.qty;
    } else {
      wholesaleCost += pricePerKg * item.qty;
    }
  }

  const sellPrice =
    typeof researchedRrp === 'number' && researchedRrp > 0
      ? researchedRrp
      : Math.round(priceForMargin(wholesaleCost, marginPercent));

  // Swap options are a curated pool, not "anything on the wholesale list" — trust the client for
  // which alternatives were offered, but still only keep ones this week's import can actually
  // price (an alternative that vanished from availability shouldn't silently stay offerable) and
  // drop an item swapping for itself.
  const normalizedItems = items.map((item) => ({
    ...item,
    swapOptions: item.swapOptions?.length
      ? [...new Set(item.swapOptions)].filter(
          (id) => id !== item.productId && cheapestByProduct.has(id)
        )
      : undefined
  }));

  const box: Box = {
    id: `box-${Date.now()}`,
    name,
    ...(description ? { description } : {}),
    weekOf,
    vendorCode,
    items: normalizedItems,
    marginPercent,
    wholesaleCost,
    ...(usePackRounding ? { boxCount } : {}),
    ...(typeof researchedRrp === 'number' && researchedRrp > 0 ? { researchedRrp } : {}),
    sellPrice,
    createdAt: new Date().toISOString()
  };
  addBox(box);
  revalidatePath('/admin/boxes');
  revalidatePath('/boxes');
  return box;
}

export async function removeBox(id: string): Promise<void> {
  deleteBoxRecord(id);
  revalidatePath('/admin/boxes');
  revalidatePath('/boxes');
}

/** Edits an existing box's guidance label only — cost/sell price are computed at save time from
 *  that week's pricing, so changing the recipe means saving a new box, not patching this one. */
export async function saveBoxDescription(id: string, description: string): Promise<Box> {
  const updated = updateBoxDescription(id, description);
  revalidatePath('/admin/boxes');
  revalidatePath('/boxes');
  return updated;
}
