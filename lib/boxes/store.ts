import fs from 'node:fs';
import path from 'node:path';
import type { Box } from './types';

const BOXES_FILE = path.join(process.cwd(), 'data', 'boxes.json');

export function loadBoxes(): Box[] {
  if (!fs.existsSync(BOXES_FILE)) return [];
  const raw = fs.readFileSync(BOXES_FILE, 'utf-8');
  if (!raw.trim()) return [];
  return JSON.parse(raw) as Box[];
}

export function saveBoxes(boxes: Box[]): void {
  fs.mkdirSync(path.dirname(BOXES_FILE), { recursive: true });
  fs.writeFileSync(BOXES_FILE, JSON.stringify(boxes, null, 2) + '\n', 'utf-8');
}

export function addBox(box: Box): void {
  const boxes = loadBoxes();
  boxes.push(box);
  saveBoxes(boxes);
}

export function deleteBox(id: string): void {
  saveBoxes(loadBoxes().filter((b) => b.id !== id));
}
