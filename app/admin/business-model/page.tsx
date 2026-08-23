import { BusinessModelPage } from 'components/business-model/business-model-page';
import { loadBoxes } from 'lib/boxes/store';
import { loadBusinessModel } from 'lib/business-model/store';

export const metadata = {
  title: 'Business Model'
};

export default function Page() {
  const boxes = loadBoxes();
  const model = loadBusinessModel();
  return <BusinessModelPage boxes={boxes} initialModel={model} />;
}
