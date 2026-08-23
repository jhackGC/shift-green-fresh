import { PricingTable, type JoinedPricingRow } from 'components/vendor-pricing/pricing-table';
import {
  listVendorCodes,
  loadAllLatestVendorPricing,
  loadProducts
} from 'lib/vendor-pricing/store';

export const metadata = {
  title: 'Vendor Pricing'
};

export default function VendorPricingPage() {
  const products = loadProducts();
  const productById = new Map(products.map((p) => [p.id, p]));
  const pricingRows = loadAllLatestVendorPricing();

  const rows: JoinedPricingRow[] = pricingRows.map((row) => {
    const product = productById.get(row.productId);
    return {
      ...row,
      productName: product?.name ?? row.productId,
      category: product?.category
    };
  });

  return (
    <PricingTable
      rows={rows}
      productCount={products.length}
      vendorCount={listVendorCodes().length}
    />
  );
}
