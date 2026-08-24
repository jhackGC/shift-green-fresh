import fs from 'node:fs';
import path from 'node:path';
import type { BoxOrder } from './types';

const BOX_ORDERS_FILE = path.join(process.cwd(), 'data', 'box-orders.json');

export function loadBoxOrders(): BoxOrder[] {
  if (!fs.existsSync(BOX_ORDERS_FILE)) return [];
  const raw = fs.readFileSync(BOX_ORDERS_FILE, 'utf-8');
  if (!raw.trim()) return [];
  return JSON.parse(raw) as BoxOrder[];
}

export function saveBoxOrders(orders: BoxOrder[]): void {
  fs.mkdirSync(path.dirname(BOX_ORDERS_FILE), { recursive: true });
  fs.writeFileSync(BOX_ORDERS_FILE, JSON.stringify(orders, null, 2) + '\n', 'utf-8');
}

export function addBoxOrder(order: BoxOrder): void {
  const orders = loadBoxOrders();
  orders.push(order);
  saveBoxOrders(orders);
}

export function updateBoxOrderStatus(id: string, status: BoxOrder['status']): BoxOrder {
  const orders = loadBoxOrders();
  const index = orders.findIndex((o) => o.id === id);
  if (index === -1) throw new Error(`No box order "${id}" found.`);
  const updated: BoxOrder = { ...orders[index]!, status };
  orders[index] = updated;
  saveBoxOrders(orders);
  return updated;
}
