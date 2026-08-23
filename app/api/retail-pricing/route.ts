import { computePricePerKg } from 'lib/vendor-pricing/normalize';
import { loadProducts } from 'lib/vendor-pricing/store';
import { updateCurrentRetailPricingRow } from 'lib/retail-pricing/store';
import type { RetailPricing } from 'lib/retail-pricing/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Saves a single retail price edit made in the admin UI straight to current.json on disk
 * (data/retail-pricing/<retailer>/current.json). This is intentionally a local, dev-time editing
 * path — same spirit as the import scripts — not a production write API.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { id, retailerCode, price } = body as {
    id?: string;
    retailerCode?: string;
    price?: number;
  };

  if (!id || !retailerCode || typeof price !== 'number' || !Number.isFinite(price)) {
    return NextResponse.json(
      { error: 'Expected { id, retailerCode, price } with a finite numeric price.' },
      { status: 400 }
    );
  }

  const products = loadProducts();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const updated = updateCurrentRetailPricingRow(
      retailerCode,
      id,
      price,
      today,
      (row: RetailPricing) => {
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
      }
    );
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 }
    );
  }
}
