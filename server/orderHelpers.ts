import type { OrderRow, ServiceRow } from "./database.js";

export type OrderLineItem = {
  service_id: number;
  name: string;
  quantity: number;
  unit_price: number;
};

export type OrderItemInput = {
  service_id: number;
  quantity: number;
};

export function formatLineLabel(item: OrderLineItem) {
  return item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name;
}

export function formatItemsSummary(items: OrderLineItem[]) {
  return items.map(formatLineLabel).join(", ");
}

export function computeItemsTotal(items: OrderLineItem[]) {
  return items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
}

export function getOrderItems(row: OrderRow): OrderLineItem[] {
  if (row.items_json) {
    try {
      const parsed = JSON.parse(row.items_json) as OrderLineItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* legacy row */
    }
  }
  return [
    {
      service_id: row.service_id ?? 0,
      name: row.service_name,
      quantity: 1,
      unit_price: row.amount,
    },
  ];
}

export function serializeOrder(row: OrderRow) {
  const items = getOrderItems(row);
  return {
    ...row,
    items,
    service_name: formatItemsSummary(items),
    amount: computeItemsTotal(items),
  };
}

export function buildItemsFromInput(
  inputs: OrderItemInput[],
  servicesById: Map<number, ServiceRow>
): OrderLineItem[] | null {
  const items: OrderLineItem[] = [];
  for (const input of inputs) {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(input.quantity) || 1)));
    const svc = servicesById.get(Number(input.service_id));
    if (!svc) continue;
    const existing = items.find((i) => i.service_id === svc.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      items.push({
        service_id: svc.id,
        name: svc.name,
        quantity: qty,
        unit_price: svc.price,
      });
    }
  }
  return items.length > 0 ? items : null;
}

export function aggregateServiceStats(rows: OrderRow[]) {
  const map = new Map<string, { quantity: number; revenue: number }>();
  for (const row of rows) {
    for (const item of getOrderItems(row)) {
      const cur = map.get(item.name) ?? { quantity: 0, revenue: 0 };
      cur.quantity += item.quantity;
      cur.revenue += item.unit_price * item.quantity;
      map.set(item.name, cur);
    }
  }
  return [...map.entries()]
    .map(([service_name, v]) => ({
      service_name,
      quantity: v.quantity,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity);
}

export function topServiceFromStats(
  stats: { service_name: string; quantity: number }[]
): { name: string; sessions: number } | null {
  if (stats.length === 0) return null;
  return { name: stats[0].service_name, sessions: stats[0].quantity };
}
