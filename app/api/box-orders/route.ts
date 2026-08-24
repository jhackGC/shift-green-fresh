import { addBoxOrder, loadBoxOrders, updateBoxOrderStatus } from 'lib/box-orders/store';
import type { BoxOrder, BoxOrderItem } from 'lib/box-orders/types';
import { loadBoxes } from 'lib/boxes/store';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(loadBoxOrders());
}

/**
 * Records a customer's box reservation, swap choices included. Body:
 * { boxId, swaps?: { productId, swappedForProductId }[], customerName, contact, note? }.
 *
 * Price and item list are never trusted from the client — both are rebuilt server-side from the
 * box as it's actually saved right now, and each swap is checked against that item's own curated
 * swapOptions pool rather than accepted as-is (the whole point of a pool is that not just
 * anything is swappable in).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { boxId, swaps, customerName, contact, note } = body as {
    boxId?: string;
    swaps?: { productId?: string; swappedForProductId?: string }[];
    customerName?: string;
    contact?: string;
    note?: string;
  };

  if (!boxId || !customerName?.trim() || !contact?.trim()) {
    return NextResponse.json(
      { error: 'Expected { boxId, customerName, contact, swaps?, note? }.' },
      { status: 400 }
    );
  }

  const box = loadBoxes().find((b) => b.id === boxId);
  if (!box) {
    return NextResponse.json({ error: `No box "${boxId}" found.` }, { status: 404 });
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
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const { id, status } = (await req.json()) as { id?: string; status?: BoxOrder['status'] };
  if (!id || !status) {
    return NextResponse.json({ error: 'Expected { id, status }.' }, { status: 400 });
  }
  try {
    const updated = updateBoxOrderStatus(id, status);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 }
    );
  }
}
