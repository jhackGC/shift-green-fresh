import { BoxOrdersPage } from 'components/box-orders/box-orders-page';
import { loadBoxOrders } from 'lib/box-orders/store';
import { loadProducts } from 'lib/vendor-pricing/store';

export const metadata = {
  title: 'Box Reservations'
};

export default function AdminBoxOrdersPage() {
  const orders = loadBoxOrders();
  const products = loadProducts();
  const itemNames = Object.fromEntries(products.map((p) => [p.id, p.name]));
  return <BoxOrdersPage initialOrders={orders} itemNames={itemNames} />;
}
