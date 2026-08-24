'use server';

import { addNonPerishable, deleteNonPerishable } from 'lib/non-perishables/store';
import type { NonPerishableItem } from 'lib/non-perishables/types';
import { revalidatePath } from 'next/cache';

export type CreateNonPerishableInput = {
  name: string;
  category?: string;
  cost: number;
  sellPrice: number;
};

export async function createNonPerishable(
  input: CreateNonPerishableInput
): Promise<NonPerishableItem> {
  const { name, category, cost, sellPrice } = input;
  if (!name || typeof cost !== 'number' || typeof sellPrice !== 'number') {
    throw new Error('A name, cost, and sell price are all required.');
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
  revalidatePath('/admin/non-perishables');
  revalidatePath('/admin/business-model');
  return item;
}

export async function removeNonPerishable(id: string): Promise<void> {
  deleteNonPerishable(id);
  revalidatePath('/admin/non-perishables');
  revalidatePath('/admin/business-model');
}
