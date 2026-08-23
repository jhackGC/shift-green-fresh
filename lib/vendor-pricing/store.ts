/**
 * Plain-fs persistence for the vendor pricing data store. Node-only (used by import scripts,
 * and safe to use from server-only app code later — never import this from a client component).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Product, VendorPricing } from './types';
import { slugify } from './normalize';

const DATA_ROOT = path.join(process.cwd(), 'data');
const PRODUCTS_FILE = path.join(DATA_ROOT, 'products.json');

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

export function loadProducts(): Product[] {
  return readJsonFile<Product[]>(PRODUCTS_FILE, []);
}

export function saveProducts(products: Product[]): void {
  writeJsonFile(PRODUCTS_FILE, products);
}

/**
 * Finds-or-creates a Product by canonical name (slug match). Mutates and returns the array
 * (matching the caller's `products` reference isn't required — always use the returned array).
 */
export function upsertProduct(
  products: Product[],
  candidate: { name: string; category?: Product['category'] }
): { products: Product[]; product: Product } {
  const id = slugify(candidate.name);
  const existing = products.find((p) => p.id === id);
  if (existing) {
    return { products, product: existing };
  }
  const product: Product = {
    id,
    name: candidate.name,
    category: candidate.category,
    avgWeightG: null
  };
  const next = [...products, product];
  return { products: next, product };
}

export function vendorPricingFilePath(vendorCode: string, date: string): string {
  return path.join(DATA_ROOT, 'vendor-pricing', vendorCode, `${date}.json`);
}

export function vendorPricingFileExists(vendorCode: string, date: string): boolean {
  return fs.existsSync(vendorPricingFilePath(vendorCode, date));
}

export function saveVendorPricing(vendorCode: string, date: string, rows: VendorPricing[]): void {
  writeJsonFile(vendorPricingFilePath(vendorCode, date), rows);
}

export function loadVendorPricing(vendorCode: string, date: string): VendorPricing[] {
  return readJsonFile<VendorPricing[]>(vendorPricingFilePath(vendorCode, date), []);
}

/** All vendor codes that have at least one import batch on disk. */
export function listVendorCodes(): string[] {
  const dir = path.join(DATA_ROOT, 'vendor-pricing');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Import batch dates available for a vendor, newest first. */
export function listDatesForVendor(vendorCode: string): string[] {
  const dir = path.join(DATA_ROOT, 'vendor-pricing', vendorCode);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort()
    .reverse();
}

/** The most recent import batch for a vendor (empty array if none exist yet). */
export function loadLatestVendorPricing(vendorCode: string): VendorPricing[] {
  const [latestDate] = listDatesForVendor(vendorCode);
  return latestDate ? loadVendorPricing(vendorCode, latestDate) : [];
}

/** The most recent batch for every known vendor, flattened into one list. */
export function loadAllLatestVendorPricing(): VendorPricing[] {
  return listVendorCodes().flatMap((vendorCode) => loadLatestVendorPricing(vendorCode));
}
