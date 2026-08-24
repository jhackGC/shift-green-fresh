import { BoxCard } from 'components/boxes/box-card';
import type { Box } from 'lib/boxes/types';

export type BoxCatalogItem = {
  box: Box;
  /** Resolved product display names, keyed by productId — covers both a box's own items and
   *  every item in every item's swap pool, since the board only knows ids. */
  itemNames: Record<string, string>;
};

/**
 * The customer-facing answer to "I know the products, not the kg" and "I don't use much
 * parsley": every box already carries a kg quantity per item internally, and a curated swap pool
 * per item where one was set up — this just puts both in front of the person deciding whether to
 * drive out, instead of keeping them to ourselves.
 */
export function BoxCatalog({ items }: { items: BoxCatalogItem[] }) {
  if (items.length === 0) {
    return (
      <p className="mx-auto max-w-[65ch] px-4 py-16 text-center text-neutral-500 dark:text-neutral-400">
        No boxes are up for this week yet — check back soon.
      </p>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ box, itemNames }) => (
        <BoxCard key={box.id} box={box} itemNames={itemNames} />
      ))}
    </div>
  );
}
