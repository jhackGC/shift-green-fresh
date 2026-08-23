import { BoxBuilder, type AvailableItem } from 'components/boxes/box-builder';
import type { PackOption } from 'lib/boxes/procurement';
import { loadBoxes } from 'lib/boxes/store';
import {
  listDatesForVendor,
  loadAllLatestVendorPricing,
  loadProducts
} from 'lib/vendor-pricing/store';

export const metadata = {
  title: 'Weekly Boxes'
};

const VENDOR_CODE = 'eco-farms';

export default function BoxesPage() {
  const products = loadProducts();
  const productById = new Map(products.map((p) => [p.id, p]));
  const vendorRows = loadAllLatestVendorPricing().filter((v) => v.vendorCode === VENDOR_CODE);

  const cheapestByProduct = new Map<string, number>();
  const packOptionsByProduct = new Map<string, PackOption[]>();
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

  const availableItems: AvailableItem[] = [...cheapestByProduct.entries()]
    .map(([productId, pricePerKg]) => {
      const product = productById.get(productId);
      return {
        productId,
        name: product?.name ?? productId,
        category: product?.category,
        pricePerKg,
        packOptions: packOptionsByProduct.get(productId) ?? []
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const [weekOf] = listDatesForVendor(VENDOR_CODE);
  const boxes = loadBoxes();

  return (
    <BoxBuilder
      vendorCode={VENDOR_CODE}
      weekOf={weekOf ?? ''}
      availableItems={availableItems}
      initialBoxes={boxes}
    />
  );
}
