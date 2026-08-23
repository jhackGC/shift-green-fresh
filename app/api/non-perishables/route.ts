import {
  addNonPerishable,
  deleteNonPerishable,
  loadNonPerishables
} from 'lib/non-perishables/store';
import type { NonPerishableItem } from 'lib/non-perishables/types';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(loadNonPerishables());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { name, category, cost, sellPrice } = body as {
    name?: string;
    category?: string;
    cost?: number;
    sellPrice?: number;
  };
  if (!name || typeof cost !== 'number' || typeof sellPrice !== 'number') {
    return NextResponse.json(
      { error: 'Expected { name, cost, sellPrice, category? }.' },
      { status: 400 }
    );
  }
  const item: NonPerishableItem = {
    id: `np-${Date.now()}`,
    name,
    ...(category ? { category } : {}),
    cost,
    sellPrice,
    createdAt: new Date().toISOString()
  };
  addNonPerishable(item);
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Expected { id }.' }, { status: 400 });
  deleteNonPerishable(id);
  return NextResponse.json({ ok: true });
}
