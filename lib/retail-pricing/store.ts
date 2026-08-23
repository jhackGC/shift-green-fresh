import fs from 'node:fs';
import path from 'node:path';
import type { PendingRetailChange, RetailPricing } from './types';

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

export function listRetailerCodes(): string[] {
  const dir = path.join(DATA_ROOT, 'retail-pricing');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// ---------- current.json: the live, editable state ----------

function currentFilePath(retailerCode: string): string {
  return path.join(DATA_ROOT, 'retail-pricing', retailerCode, 'current.json');
}

export function loadCurrentRetailPricing(retailerCode: string): RetailPricing[] {
  return readJsonFile<RetailPricing[]>(currentFilePath(retailerCode), []);
}

export function saveCurrentRetailPricing(retailerCode: string, rows: RetailPricing[]): void {
  writeJsonFile(currentFilePath(retailerCode), rows);
}

export function loadAllCurrentRetailPricing(): RetailPricing[] {
  return listRetailerCodes().flatMap((retailerCode) => loadCurrentRetailPricing(retailerCode));
}

/**
 * Updates one row's price in `current.json` in place and recomputes its normalized $/kg (via
 * `recompute`, injected by the caller so this module doesn't need to know about unit-conversion
 * or products — see app/api/retail-pricing/route.ts). Throws if the row id doesn't exist.
 */
export function updateCurrentRetailPricingRow(
  retailerCode: string,
  id: string,
  price: number,
  date: string,
  recompute: (
    row: RetailPricing
  ) => Pick<RetailPricing, 'pricePerDestinationUnit' | 'needsConversionFactor'>
): RetailPricing {
  const rows = loadCurrentRetailPricing(retailerCode);
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) {
    throw new Error(`No current retail pricing row "${id}" found for ${retailerCode}.`);
  }
  const existing = rows[index]!;
  const updated: RetailPricing = { ...existing, price, date };
  Object.assign(updated, recompute(updated));
  rows[index] = updated;
  saveCurrentRetailPricing(retailerCode, rows);
  return updated;
}

// ---------- imports/<date>.json: historical, append-only ingest snapshots (audit trail only,
// never read by the live app) ----------

function importSnapshotFilePath(retailerCode: string, date: string): string {
  return path.join(DATA_ROOT, 'retail-pricing', retailerCode, 'imports', `${date}.json`);
}

export function importSnapshotExists(retailerCode: string, date: string): boolean {
  return fs.existsSync(importSnapshotFilePath(retailerCode, date));
}

export function saveImportSnapshot(
  retailerCode: string,
  date: string,
  rows: RetailPricing[]
): void {
  writeJsonFile(importSnapshotFilePath(retailerCode, date), rows);
}

// ---------- pending.json: changes a re-ingest proposed that differ from current, awaiting
// approve/reject in the admin UI ----------

function pendingFilePath(retailerCode: string): string {
  return path.join(DATA_ROOT, 'retail-pricing', retailerCode, 'pending.json');
}

export function loadPendingRetailChanges(retailerCode: string): PendingRetailChange[] {
  return readJsonFile<PendingRetailChange[]>(pendingFilePath(retailerCode), []);
}

export function savePendingRetailChanges(
  retailerCode: string,
  changes: PendingRetailChange[]
): void {
  writeJsonFile(pendingFilePath(retailerCode), changes);
}

export function loadAllPendingRetailChanges(): PendingRetailChange[] {
  return listRetailerCodes().flatMap((retailerCode) => loadPendingRetailChanges(retailerCode));
}

/**
 * Approves or rejects one pending change. Approving swaps in the *entire* proposed row (not just
 * its price) — the re-ingest that proposed it may also have fixed the matching label/note, and
 * only updating price would leave that metadata stale. Rejecting just discards the pending entry
 * and keeps current.json untouched. Either way the change is removed from pending.json. Throws if
 * no pending change exists for that id.
 */
export function resolvePendingRetailChange(
  retailerCode: string,
  id: string,
  action: 'approve' | 'reject'
): RetailPricing | null {
  const pending = loadPendingRetailChanges(retailerCode);
  const index = pending.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error(`No pending change "${id}" at ${retailerCode}.`);
  }
  const change = pending[index]!;
  pending.splice(index, 1);
  savePendingRetailChanges(retailerCode, pending);

  if (action === 'reject') return null;

  const current = loadCurrentRetailPricing(retailerCode);
  const rowIndex = current.findIndex((r) => r.id === change.id);
  if (rowIndex === -1) {
    throw new Error(`Current row "${change.id}" disappeared for ${retailerCode}.`);
  }
  current[rowIndex] = change.proposedRow;
  saveCurrentRetailPricing(retailerCode, current);
  return change.proposedRow;
}
