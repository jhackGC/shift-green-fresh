import {
  RetailPricingTable,
  type JoinedRetailRow
} from 'components/retail-pricing/retail-pricing-table';
import { loadAllCurrentRetailPricing, loadAllPendingRetailChanges } from 'lib/retail-pricing/store';
import { loadAllLatestVendorPricing, loadProducts } from 'lib/vendor-pricing/store';

export const metadata = {
  title: 'Retail Pricing'
};

export default function RetailPricingPage() {
  const products = loadProducts();
  const productById = new Map(products.map((p) => [p.id, p]));
  const retailRows = loadAllCurrentRetailPricing();
  const pending = loadAllPendingRetailChanges();

  // Cheapest known wholesale $/kg per product, across every vendor (currently just eco-farms) —
  // one product can have several vendor pack/grower options, so this picks the best-case cost a
  // retailer's margin could be measured against.
  const cheapestWholesaleByProduct = new Map<string, { pricePerKg: number; vendorCode: string }>();
  for (const vr of loadAllLatestVendorPricing()) {
    if (vr.pricePerDestinationUnit == null) continue;
    const existing = cheapestWholesaleByProduct.get(vr.productId);
    if (!existing || vr.pricePerDestinationUnit < existing.pricePerKg) {
      cheapestWholesaleByProduct.set(vr.productId, {
        pricePerKg: vr.pricePerDestinationUnit,
        vendorCode: vr.vendorCode
      });
    }
  }

  const rows: JoinedRetailRow[] = retailRows.map((row) => {
    const product = productById.get(row.productId);
    const wholesale = cheapestWholesaleByProduct.get(row.productId);
    return {
      ...row,
      productName: product?.name ?? row.productId,
      category: product?.category,
      wholesalePricePerKg: wholesale?.pricePerKg ?? null,
      wholesaleVendorCode: wholesale?.vendorCode
    };
  });

  const pendingJoined = pending.map((change) => ({
    ...change,
    productName: productById.get(change.productId)?.name ?? change.productId
  }));

  return <RetailPricingTable rows={rows} pending={pendingJoined} />;
}
