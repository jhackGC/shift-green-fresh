import { BusinessModelPage } from 'components/business-model/business-model-page';
import { loadBoxes } from 'lib/boxes/store';
import { loadBusinessModel } from 'lib/business-model/store';
import { loadNonPerishables } from 'lib/non-perishables/store';

export const metadata = {
  title: 'Business Model'
};

export default function Page() {
  const boxes = loadBoxes();
  const nonPerishables = loadNonPerishables();
  const model = loadBusinessModel();
  return <BusinessModelPage boxes={boxes} nonPerishables={nonPerishables} initialModel={model} />;
}
