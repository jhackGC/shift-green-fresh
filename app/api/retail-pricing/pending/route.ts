import { computePricePerKg } from 'lib/vendor-pricing/normalize';
import { loadProducts } from 'lib/vendor-pricing/store';
import { resolvePendingRetailChange } from 'lib/retail-pricing/store';
import type { RetailPricing } from 'lib/retail-pricing/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Approves or rejects one pending retail price change (see lib/retail-pricing/store.ts). Approve
 * applies the proposed price to current.json; reject discards the proposal and keeps whatever's
 * currently live. Either way it's removed from pending.json.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { id, retailerCode, action } = body as {
    id?: string;
    retailerCode?: string;
    action?: 'approve' | 'reject';
  };

  if (!id || !retailerCode || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json(
      { error: 'Expected { id, retailerCode, action: "approve" | "reject" }.' },
      { status: 400 }
    );
  }

  const products = loadProducts();

  try {
    const updated = resolvePendingRetailChange(retailerCode, id, action, (row: RetailPricing) => {
      const product = products.find((p) => p.id === row.productId);
      const conversion = computePricePerKg(
        row.price,
        row.qty,
        row.retailUnit,
        product?.avgWeightG ?? null
      );
      return {
        pricePerDestinationUnit: conversion.value,
        needsConversionFactor: conversion.needsConversionFactor
      };
    });
    return NextResponse.json({ action, updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 }
    );
  }
}
