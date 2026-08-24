'use server';

import {
  resolvePendingRetailChange,
  updateCurrentRetailPricingRow
} from 'lib/retail-pricing/store';
import type { RetailPricing } from 'lib/retail-pricing/types';
import { computePricePerKg } from 'lib/vendor-pricing/normalize';
import { loadProducts } from 'lib/vendor-pricing/store';
import { revalidatePath } from 'next/cache';

/**
 * Saves a single retail price edit made in the admin UI straight to current.json on disk
 * (data/retail-pricing/<retailer>/current.json). This is intentionally a local, dev-time editing
 * path — same spirit as the import scripts — not a production write API.
 */
export async function updateRetailPrice(
  id: string,
  retailerCode: string,
  price: number
): Promise<RetailPricing> {
  if (!id || !retailerCode || typeof price !== 'number' || !Number.isFinite(price)) {
    throw new Error('Expected an id, retailer, and a finite numeric price.');
  }

  const products = loadProducts();
  const today = new Date().toISOString().slice(0, 10);

  const updated = updateCurrentRetailPricingRow(retailerCode, id, price, today, (row) => {
    const product = products.find((p) => p.id === row.productId);
    const conversion = computePricePerKg(
      price,
      row.qty,
      row.retailUnit,
      product?.avgWeightG ?? null
    );
    return {
      pricePerDestinationUnit: conversion.value,
      needsConversionFactor: conversion.needsConversionFactor
    };
  });
  revalidatePath('/admin/retail-pricing');
  return updated;
}

/**
 * Approves or rejects one pending retail price change (see lib/retail-pricing/store.ts). Approve
 * swaps in the whole proposed row (price, and any label/note changes the re-ingest made) into
 * current.json; reject discards the proposal and keeps whatever's currently live. Either way it's
 * removed from pending.json.
 */
export async function resolvePendingRetailPriceChange(
  id: string,
  retailerCode: string,
  action: 'approve' | 'reject'
): Promise<{ action: 'approve' | 'reject'; updated: RetailPricing | null }> {
  if (!id || !retailerCode || (action !== 'approve' && action !== 'reject')) {
    throw new Error('Expected an id, retailer, and action of "approve" or "reject".');
  }
  const updated = resolvePendingRetailChange(retailerCode, id, action);
  revalidatePath('/admin/retail-pricing');
  return { action, updated };
}
