'use server';

import { saveBusinessModel } from 'lib/business-model/store';
import type {
  BoxMixEntry,
  BusinessAssumptions,
  BusinessModel,
  NonPerishableMixEntry
} from 'lib/business-model/types';
import { revalidatePath } from 'next/cache';

export type SaveBusinessModelInput = {
  assumptions: BusinessAssumptions;
  boxMix: BoxMixEntry[];
  nonPerishableMix?: NonPerishableMixEntry[];
};

export async function updateBusinessModel(input: SaveBusinessModelInput): Promise<BusinessModel> {
  if (!input.assumptions || !Array.isArray(input.boxMix)) {
    throw new Error('Expected assumptions and a box mix.');
  }
  const saved = saveBusinessModel({
    assumptions: input.assumptions,
    boxMix: input.boxMix,
    nonPerishableMix: input.nonPerishableMix ?? []
  });
  revalidatePath('/admin/business-model');
  return saved;
}
