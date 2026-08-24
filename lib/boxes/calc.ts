import type { Box } from './types';

/** Total produce weight in a box — the sum of each item's kg quantity. Customers see product
 *  names on the board ("carrots", "roma tomatoes") but not what that adds up to in kg; this is
 *  the number that answers "what am I actually getting." */
export function boxTotalKg(box: Box): number {
  return box.items.reduce((sum, item) => sum + item.qty, 0);
}

/** Sell price per kg — the same "value" number the Business Model tool and the competitor
 *  research both key off, surfaced here so a customer can see it too instead of just us. */
export function boxPricePerKg(box: Box): number {
  const kg = boxTotalKg(box);
  return kg > 0 ? box.sellPrice / kg : 0;
}
