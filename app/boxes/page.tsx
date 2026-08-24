import { BoxCatalog, type BoxCatalogItem } from 'components/boxes/box-catalog';
import { loadBoxes } from 'lib/boxes/store';
import { loadProducts } from 'lib/vendor-pricing/store';

export const metadata = {
  title: 'This Week’s Boxes',
  description:
    'Certified organic fruit & veg boxes, priced and weighed up front. Pickup only, Varsity Lakes.'
};

export default function CustomerBoxesPage() {
  const boxes = loadBoxes();
  const products = loadProducts();
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const items: BoxCatalogItem[] = boxes.map((box) => {
    const ids = new Set<string>();
    for (const item of box.items) {
      ids.add(item.productId);
      for (const swapId of item.swapOptions ?? []) ids.add(swapId);
    }
    return {
      box,
      itemNames: Object.fromEntries([...ids].map((id) => [id, nameById.get(id) ?? id]))
    };
  });

  const latestWeekOf = boxes
    .map((b) => b.weekOf)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div>
      <header className="mx-auto max-w-[1100px] px-4 pt-10">
        <h1 className="text-3xl font-bold tracking-tight">This Week&rsquo;s Boxes</h1>
        <p className="mt-2 max-w-[65ch] text-neutral-600 dark:text-neutral-400">
          Certified organic, sourced fresh each week. Every box lists exactly how much you&rsquo;re
          getting in kg, not just what&rsquo;s in it, so the price is easy to weigh up before you
          drive out &mdash; not something to guess at once you&rsquo;re here.
        </p>
        {latestWeekOf && (
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            Priced against the week of {latestWeekOf} &middot; pickup only, Varsity Lakes
          </p>
        )}
      </header>
      <BoxCatalog items={items} />
    </div>
  );
}
