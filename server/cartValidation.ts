import type { OrderItemInput, OrderLineItem } from "./orderHelpers.js";

export function validateOrderItemsHaveStaff(
  items: OrderItemInput[],
  serviceNames: Map<number, string>
): string | null {
  for (const item of items) {
    const name = serviceNames.get(Number(item.service_id)) ?? "Dịch vụ";
    if (!Array.isArray(item.assignments) || item.assignments.length === 0) {
      return `«${name}»: chưa chọn thợ. Mỗi dịch vụ phải có ít nhất một thợ.`;
    }
  }
  return null;
}

export function validateOrderItemsNoDuplicateStaff(
  items: OrderItemInput[],
  serviceNames: Map<number, string>
): string | null {
  for (const item of items) {
    if (!item.assignments?.length) continue;
    const seen = new Set<number>();
    for (const a of item.assignments) {
      const id = Number(a.employee_id);
      if (seen.has(id)) {
        const name = serviceNames.get(item.service_id) ?? "Dịch vụ";
        return `«${name}»: cùng một thợ được gán trùng. Mỗi thợ chỉ gán một lần cho một dịch vụ.`;
      }
      seen.add(id);
    }
  }
  return null;
}

export function validateOrderItemsForSubmit(
  items: OrderItemInput[],
  serviceNames: Map<number, string>
): string | null {
  const staffErr = validateOrderItemsHaveStaff(items, serviceNames);
  if (staffErr) return staffErr;
  return validateOrderItemsNoDuplicateStaff(items, serviceNames);
}

export function validateLineItemsHaveStaff(items: OrderLineItem[]): string | null {
  for (const item of items) {
    if (!item.assignments?.length) {
      return `«${item.name}»: chưa có thợ. Gán thợ cho từng dịch vụ trước khi thu tiền.`;
    }
  }
  return null;
}

export function lineItemsToValidationInput(items: OrderLineItem[]): OrderItemInput[] {
  return items.map((item) => ({
    service_id: item.service_id,
    quantity: item.quantity,
    assignments: (item.assignments ?? []).map((a) => ({
      employee_id: a.employee_id,
      role_id: a.role_id,
    })),
  }));
}
