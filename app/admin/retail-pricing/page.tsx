import {
  RetailPricingTable,
  type JoinedRetailRow
} from 'components/retail-pricing/retail-pricing-table';
import { loadAllCurrentRetailPricing, loadAllPendingRetailChanges } from 'lib/retail-pricing/store';
import { loadProducts } from 'lib/vendor-pricing/store';

export const metadata = {
  title: 'Retail Pricing'
};

export default function RetailPricingPage() {
  const products = loadProducts();
  const productById = new Map(products.map((p) => [p.id, p]));
  const retailRows = loadAllCurrentRetailPricing();
  const pending = loadAllPendingRetailChanges();

  const rows: JoinedRetailRow[] = retailRows.map((row) => {
    const product = productById.get(row.productId);
    return {
      ...row,
      productName: product?.name ?? row.productId,
      category: product?.category
    };
  });

  const pendingJoined = pending.map((change) => ({
    ...change,
    productName: productById.get(change.productId)?.name ?? change.productId
  }));

  return <RetailPricingTable rows={rows} pending={pendingJoined} />;
}
