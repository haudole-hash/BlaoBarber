import type { EmployeeRow, OrderRow, ServiceRolePointRow, StaffRoleRow } from "./database.js";
import { getOrderItems, type OrderAssignment, type OrderLineItem } from "./orderHelpers.js";
import { isProxyRole } from "./proxyRole.js";

export { isProxyRole } from "./proxyRole.js";

export function computeEarningsVnd(points: number, salaryCoefficient: number, pointRateVnd: number) {
  return Math.round(points * salaryCoefficient * pointRateVnd);
}

export function buildPointsMap(rows: ServiceRolePointRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(`${r.service_id}:${r.role_id}`, r.points);
  }
  return map;
}

export function lookupServiceRolePoints(
  pointsMap: Map<string, number>,
  serviceId: number,
  roleId: number
) {
  return pointsMap.get(`${serviceId}:${roleId}`) ?? 0;
}

export type PayrollContext = {
  employeesById: Map<number, EmployeeRow>;
  rolesById: Map<number, StaffRoleRow>;
  pointsMap: Map<string, number>;
  pointRateVnd: number;
  /** service_id -> shop_percent (0-100) */
  shopPercentByServiceId: Map<number, number>;
};

export function enrichAssignment(
  ctx: PayrollContext,
  serviceId: number,
  quantity: number,
  input: OrderAssignment
): OrderAssignment {
  const emp = ctx.employeesById.get(input.employee_id);
  if (!emp) {
    return {
      ...input,
      points: 0,
      earnings: 0,
      is_proxy: false,
    };
  }
  const roleId = emp.role_id;
  const role = ctx.rolesById.get(roleId);
  if (isProxyRole(role)) {
    return {
      employee_id: input.employee_id,
      role_id: roleId,
      employee_name: emp.name ?? input.employee_name,
      role_name: role?.name ?? input.role_name,
      points: 0,
      earnings: 0,
      is_proxy: true,
    };
  }
  const basePoints = lookupServiceRolePoints(ctx.pointsMap, serviceId, roleId);
  const points = basePoints * quantity;
  const coeff = emp.salary_coefficient ?? 1;
  const earnings = computeEarningsVnd(points, coeff, ctx.pointRateVnd);
  return {
    employee_id: input.employee_id,
    role_id: roleId,
    employee_name: emp.name ?? input.employee_name,
    role_name: role?.name ?? input.role_name,
    points,
    earnings,
    is_proxy: false,
  };
}

export function enrichLineItemAssignments(item: OrderLineItem, ctx: PayrollContext): OrderLineItem {
  if (!item.assignments?.length) {
    return { ...item, has_proxy: false, shop_cut: 0, shop_percent: 0 };
  }

  const enriched = item.assignments.map((a) =>
    enrichAssignment(ctx, item.service_id, item.quantity, a)
  );
  const proxies = enriched.filter((a) => a.is_proxy);
  const others = enriched.filter((a) => !a.is_proxy);

  if (proxies.length === 0) {
    return {
      ...item,
      assignments: others,
      has_proxy: false,
      shop_cut: 0,
      shop_percent: 0,
    };
  }

  const lineTotal = item.unit_price * item.quantity;
  const rawPercent = ctx.shopPercentByServiceId.get(item.service_id) ?? 0;
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
}

export function enrichOrderItemsForPayroll(items: OrderLineItem[], ctx: PayrollContext) {
  return items.map((item) => enrichLineItemAssignments(item, ctx));
}

export function primaryBarberLabel(items: OrderLineItem[]) {
  const names = new Set<string>();
  for (const item of items) {
    for (const a of item.assignments ?? []) {
      if (a.employee_name) names.add(a.employee_name);
    }
  }
  if (names.size === 0) return "—";
  return [...names].join(", ");
}

export type WorkLogEntry = {
  order_id: number;
  completed_at: string;
  customer_name: string;
  service_id: number;
  service_name: string;
  quantity: number;
  employee_id: number;
  employee_name: string;
  role_id: number;
  role_name: string;
  points: number;
  earnings: number;
  is_proxy: boolean;
};

export function collectWorkLogFromOrders(
  rows: OrderRow[],
  employeesById: Map<number, EmployeeRow>,
  rolesById: Map<number, StaffRoleRow>
): WorkLogEntry[] {
  const out: WorkLogEntry[] = [];
  for (const row of rows) {
    if (row.status !== "completed" || !row.completed_at) continue;
    for (const item of getOrderItems(row)) {
      for (const a of item.assignments ?? []) {
        const emp = employeesById.get(a.employee_id);
        const role = rolesById.get(a.role_id);
        const isProxy = Boolean(a.is_proxy) || isProxyRole(role);
        out.push({
          order_id: row.id,
          completed_at: row.completed_at,
          customer_name: row.customer_name,
          service_id: item.service_id,
          service_name: item.name,
          quantity: item.quantity,
          employee_id: a.employee_id,
          employee_name: a.employee_name ?? emp?.name ?? `#${a.employee_id}`,
          role_id: a.role_id,
          role_name: a.role_name ?? role?.name ?? "",
          points: a.points ?? 0,
          earnings: a.earnings ?? 0,
          is_proxy: isProxy,
        });
      }
    }
  }
  return out.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
}

/** Chi phi luong quan chi tra — khong tinh phan chu gia lap */
export function sumShopPayroll(entries: WorkLogEntry[]) {
  return entries.reduce((s, e) => s + (e.is_proxy ? 0 : Number(e.earnings) || 0), 0);
}
