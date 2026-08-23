import { NonPerishablesPage } from 'components/non-perishables/non-perishables-page';
import { loadNonPerishables } from 'lib/non-perishables/store';

export const metadata = {
  title: 'Non-Perishables'
};

export default function Page() {
  return <NonPerishablesPage initialItems={loadNonPerishables()} />;
}
