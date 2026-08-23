import fs from 'node:fs';
import path from 'node:path';
import type { RetailPricing } from './types';

const DATA_ROOT = path.join(process.cwd(), 'data');

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf-8');
  if (!raw.trim()) return fallback;
  return JSON.parse(raw) as T;
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function retailPricingFilePath(retailerCode: string, date: string): string {
  return path.join(DATA_ROOT, 'retail-pricing', retailerCode, `${date}.json`);
}

export function retailPricingFileExists(retailerCode: string, date: string): boolean {
  return fs.existsSync(retailPricingFilePath(retailerCode, date));
}

export function saveRetailPricing(retailerCode: string, date: string, rows: RetailPricing[]): void {
  writeJsonFile(retailPricingFilePath(retailerCode, date), rows);
}

export function loadRetailPricing(retailerCode: string, date: string): RetailPricing[] {
  return readJsonFile<RetailPricing[]>(retailPricingFilePath(retailerCode, date), []);
}

export function listRetailerCodes(): string[] {
  const dir = path.join(DATA_ROOT, 'retail-pricing');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function listDatesForRetailer(retailerCode: string): string[] {
  const dir = path.join(DATA_ROOT, 'retail-pricing', retailerCode);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort()
    .reverse();
}

export function loadLatestRetailPricing(retailerCode: string): RetailPricing[] {
  const [latestDate] = listDatesForRetailer(retailerCode);
  return latestDate ? loadRetailPricing(retailerCode, latestDate) : [];
}

export function loadAllLatestRetailPricing(): RetailPricing[] {
  return listRetailerCodes().flatMap((retailerCode) => loadLatestRetailPricing(retailerCode));
}
