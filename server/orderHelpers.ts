import { db, type OrderRow, type ServiceRow, type StaffRoleRow } from "./database.js";
import { isProxyRole } from "./proxyRole.js";

export type OrderAssignment = {
  employee_id: number;
  role_id: number;
  employee_name?: string;
  role_name?: string;
  points?: number;
  earnings?: number;
  /** True khi role la Ong chu gia lap */
  is_proxy?: boolean;
};

export type OrderLineItem = {
  service_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  assignments?: OrderAssignment[];
  /** % tra tiem (chi khi co chu gia lap tren dong) */
  shop_percent?: number;
  /** So tien tiem nhan tu dong nay */
  shop_cut?: number;
  has_proxy?: boolean;
};

export type OrderAssignmentInput = {
  employee_id: number;
  role_id: number;
};

export type OrderItemInput = {
  service_id: number;
  quantity: number;
  assignments?: OrderAssignmentInput[];
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

/** Tien khach tra (gia tri don da luu) */
export function orderCustomerAmount(row: OrderRow) {
  return Number(row.amount) || 0;
}

function loadProxyLookup() {
  const roles = db.prepare("SELECT * FROM staff_roles").all() as StaffRoleRow[];
  const services = db.prepare("SELECT id, shop_percent FROM services").all() as {
    id: number;
    shop_percent: number;
  }[];
  return {
    rolesById: new Map(roles.map((r) => [r.id, r])),
    shopPercentByServiceId: new Map(services.map((s) => [s.id, Number(s.shop_percent) || 0])),
  };
}

/**
 * Bo sung has_proxy / shop_cut / is_proxy cho don cu (truoc khi co logic proxy)
 * hoac don ma role chua duoc danh dau dung luc thu tien.
 */
export function hydrateProxyFieldsOnItems(
  items: OrderLineItem[],
  rolesById: Map<number, StaffRoleRow>,
  shopPercentByServiceId: Map<number, number>
): OrderLineItem[] {
  return items.map((item) => {
    const assignments = (item.assignments ?? []).map((a) => {
      const role = rolesById.get(a.role_id);
      const proxy = Boolean(a.is_proxy) || isProxyRole(role);
      return {
        ...a,
        is_proxy: proxy,
        role_name: a.role_name ?? role?.name ?? a.role_name,
      };
    });

    const proxies = assignments.filter((a) => a.is_proxy);
    const others = assignments.filter((a) => !a.is_proxy);

    if (proxies.length === 0) {
      return {
        ...item,
        assignments,
        has_proxy: false,
        shop_cut: 0,
        shop_percent: 0,
      };
    }

    const alreadyOk =
      item.has_proxy &&
      item.shop_cut != null &&
      proxies.every((p) => p.earnings != null && Number.isFinite(Number(p.earnings)));

    if (alreadyOk) {
      return {
        ...item,
        assignments,
        has_proxy: true,
        shop_cut: Number(item.shop_cut) || 0,
        shop_percent: Number(item.shop_percent) || 0,
      };
    }

    const lineTotal = item.unit_price * item.quantity;
    const rawPercent =
      item.shop_percent ?? shopPercentByServiceId.get(item.service_id) ?? 0;
    const shopPercent = Math.max(0, Math.min(100, Number(rawPercent) || 0));
    const shopCut = Math.round((lineTotal * shopPercent) / 100);
    const othersPay = others.reduce((s, a) => s + (Number(a.earnings) || 0), 0);
    const remainder = Math.max(0, lineTotal - shopCut - othersPay);

    const n = proxies.length;
    const baseShare = Math.floor(remainder / n);
    let allocated = 0;
    const proxyAssignments = proxies.map((a, idx) => {
      const earnings = idx === n - 1 ? remainder - allocated : baseShare;
      allocated += earnings;
      return { ...a, points: 0, earnings, is_proxy: true as const };
    });

    return {
      ...item,
      assignments: [...others, ...proxyAssignments],
      has_proxy: true,
      shop_percent: shopPercent,
      shop_cut: shopCut,
    };
  });
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

/** Items da hydrate proxy — dung cho doanh thu / chi tiet don */
export function getOrderItemsForAccounting(row: OrderRow): OrderLineItem[] {
  const { rolesById, shopPercentByServiceId } = loadProxyLookup();
  return hydrateProxyFieldsOnItems(getOrderItems(row), rolesById, shopPercentByServiceId);
}

/**
 * Doanh thu quan ghi so:
 * - Bill thuong: full amount
 * - Bill co chu gia lap: tong shop_cut = % Tiem tren dich vu (scale theo giam gia neu co)
 */
export function orderShopRevenue(row: OrderRow) {
  const items = getOrderItemsForAccounting(row);
  const hasProxy = items.some((i) => i.has_proxy || (i.assignments ?? []).some((a) => a.is_proxy));
  if (!hasProxy) return orderCustomerAmount(row);

  const shopCuts = items.reduce((s, i) => s + (Number(i.shop_cut) || 0), 0);
  const gross = computeItemsTotal(items);
  const paid = orderCustomerAmount(row);
  if (gross <= 0) return shopCuts;
  if (paid === gross) return shopCuts;
  return Math.round(shopCuts * (paid / gross));
}

/** @deprecated alias — dung orderShopRevenue cho dashboard/loi nhuan */
export function orderRevenueAmount(row: OrderRow) {
  return orderShopRevenue(row);
}

export function sumOrderRevenue(rows: OrderRow[]) {
  return rows.reduce((s, r) => s + orderShopRevenue(r), 0);
}

export function serializeOrder(row: OrderRow) {
  const items = getOrderItemsForAccounting(row);
  return {
    ...row,
    items,
    service_name: formatItemsSummary(items),
    amount: orderCustomerAmount(row),
    shop_revenue: orderShopRevenue(row),
    has_proxy: items.some((i) => i.has_proxy || (i.assignments ?? []).some((a) => a.is_proxy)),
    discount_percent: Number(row.discount_percent ?? 0) || 0,
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
    const assignments =
      Array.isArray(input.assignments) && input.assignments.length > 0
        ? input.assignments.map((a) => ({
            employee_id: Number(a.employee_id),
            role_id: Number(a.role_id),
          }))
        : undefined;
    items.push({
      service_id: svc.id,
      name: svc.name,
      quantity: qty,
      unit_price: svc.price,
      assignments,
    });
  }
  return items.length > 0 ? items : null;
}

export function aggregateServiceStats(rows: OrderRow[]) {
  const map = new Map<string, { quantity: number; revenue: number }>();
  for (const row of rows) {
    const items = getOrderItemsForAccounting(row);
    const gross = computeItemsTotal(items);
    const orderTotal = orderShopRevenue(row);
    const ratio = gross > 0 ? orderTotal / gross : 1;
    for (const item of items) {
      const cur = map.get(item.name) ?? { quantity: 0, revenue: 0 };
      cur.quantity += item.quantity;
      if (item.has_proxy) {
        cur.revenue += Number(item.shop_cut) || 0;
      } else {
        cur.revenue += Math.round(item.unit_price * item.quantity * ratio);
      }
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
