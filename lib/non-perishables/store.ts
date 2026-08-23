import fs from 'node:fs';
import path from 'node:path';
import type { NonPerishableItem } from './types';

const FILE = path.join(process.cwd(), 'data', 'non-perishables.json');

export function loadNonPerishables(): NonPerishableItem[] {
  if (!fs.existsSync(FILE)) return [];
  const raw = fs.readFileSync(FILE, 'utf-8');
  if (!raw.trim()) return [];
  return JSON.parse(raw) as NonPerishableItem[];
}

export function saveNonPerishables(items: NonPerishableItem[]): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2) + '\n', 'utf-8');
}

export function addNonPerishable(item: NonPerishableItem): void {
  const items = loadNonPerishables();
  items.push(item);
  saveNonPerishables(items);
}

export function deleteNonPerishable(id: string): void {
  saveNonPerishables(loadNonPerishables().filter((i) => i.id !== id));
}
