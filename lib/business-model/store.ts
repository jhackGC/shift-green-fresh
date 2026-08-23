import fs from 'node:fs';
import path from 'node:path';
import { EMPTY_BUSINESS_MODEL, type BusinessModel } from './types';

const FILE = path.join(process.cwd(), 'data', 'business-model.json');

export function loadBusinessModel(): BusinessModel {
  if (!fs.existsSync(FILE)) return EMPTY_BUSINESS_MODEL;
  const raw = fs.readFileSync(FILE, 'utf-8');
  if (!raw.trim()) return EMPTY_BUSINESS_MODEL;
  return JSON.parse(raw) as BusinessModel;
}

export function saveBusinessModel(
  model: Pick<BusinessModel, 'assumptions' | 'boxMix'>
): BusinessModel {
  const full: BusinessModel = { ...model, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(full, null, 2) + '\n', 'utf-8');
  return full;
}
