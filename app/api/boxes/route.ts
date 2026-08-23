import { priceForMargin } from 'lib/margins/calc';
import { addBox, deleteBox, loadBoxes, updateBoxDescription } from 'lib/boxes/store';
import { betterProcurement, planProcurement } from 'lib/boxes/procurement';
import type { Box, BoxItem } from 'lib/boxes/types';
import { loadAllLatestVendorPricing, loadProducts } from 'lib/vendor-pricing/store';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(loadBoxes());
}

/**
 * Saves a new box. Body: { name, weekOf, vendorCode, marginPercent, items: [{productId, qty}],
 * boxCount?, researchedRrp? }. Cost/sell price are computed server-side from that week's actual
 * wholesale pricing, not trusted from the client, so a saved box always reflects real numbers.
 *
 * When `boxCount` is given, cost is pack-rounding-aware: for each item, total demand across all
 * boxes is procured as whole packs or (eco-farms' own 20% handling fee) a split pack, whichever
 * is cheaper, then divided back down to a per-box cost — a more honest number than assuming you
 * can buy the exact fractional kg needed at the cheapest listed $/kg.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { name, description, weekOf, vendorCode, marginPercent, items, boxCount, researchedRrp } =
    body as {
      name?: string;
      description?: string;
      weekOf?: string;
      vendorCode?: string;
      marginPercent?: number;
      items?: BoxItem[];
      boxCount?: number;
      researchedRrp?: number;
    };

  if (
    !name ||
    !weekOf ||
    !vendorCode ||
    typeof marginPercent !== 'number' ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          'Expected { name, weekOf, vendorCode, marginPercent, items: [{productId, qty}] } with at least one item.'
      },
      { status: 400 }
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
      const name = productById.get(item.productId)?.name ?? item.productId;
      return NextResponse.json(
        {
          error: `No priced ${vendorCode} line for "${name}" this week — remove it or wait for a fresh import.`
        },
        { status: 400 }
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

  const box: Box = {
    id: `box-${Date.now()}`,
    name,
    ...(description ? { description } : {}),
    weekOf,
    vendorCode,
    items,
    marginPercent,
    wholesaleCost,
    ...(usePackRounding ? { boxCount } : {}),
    ...(typeof researchedRrp === 'number' && researchedRrp > 0 ? { researchedRrp } : {}),
    sellPrice,
    createdAt: new Date().toISOString()
  };
  addBox(box);
  return NextResponse.json(box);
}

/** Edits an existing box's guidance label only — cost/sell price are computed at save time from
 *  that week's pricing, so changing the recipe means saving a new box, not patching this one. */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const { id, description } = (await req.json()) as { id?: string; description?: string };
  if (!id) return NextResponse.json({ error: 'Expected { id, description }.' }, { status: 400 });
  try {
    const updated = updateBoxDescription(id, description ?? '');
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Expected { id }.' }, { status: 400 });
  deleteBox(id);
  return NextResponse.json({ ok: true });
}
