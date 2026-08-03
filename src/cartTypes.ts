import type { Employee, Service } from "./types";

export type CartAssignment = {
  employeeId: number;
  roleId: number;
};

export type CartLine = {
  lineId: string;
  serviceId: number;
  quantity: number;
  assignments: CartAssignment[];
};

export function newCartLineId() {
  return `l-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function cartToOrderItems(cart: CartLine[]) {
  return cart.map((c) => ({
    service_id: c.serviceId,
    quantity: c.quantity,
    assignments: c.assignments.map((a) => ({
      employee_id: a.employeeId,
      role_id: a.roleId,
    })),
  }));
}

/** Mỗi dòng dịch vụ phải có ít nhất một thợ */
export function validateCartHasStaff(cart: CartLine[], services: Service[]): string | null {
  for (const line of cart) {
    if (line.assignments.length === 0) {
      const svcName = services.find((s) => s.id === line.serviceId)?.name ?? "Dịch vụ";
      return `«${svcName}»: chưa chọn thợ. Mỗi dịch vụ phải có ít nhất một thợ trước khi lưu đơn.`;
    }
  }
  return null;
}

export function validateCartBeforeSubmit(
  cart: CartLine[],
  services: Service[],
  employees: Employee[]
): string | null {
  const staffErr = validateCartHasStaff(cart, services);
  if (staffErr) return staffErr;
  return validateCartNoDuplicateStaff(cart, services, employees);
}

/** Trả về thông báo lỗi nếu cùng một thợ được gán 2+ lần trên một dòng dịch vụ */
export function validateCartNoDuplicateStaff(
  cart: CartLine[],
  services: Service[],
  employees: Employee[]
): string | null {
  for (const line of cart) {
    const svcName = services.find((s) => s.id === line.serviceId)?.name ?? "Dịch vụ";
    const seen = new Set<number>();
    for (const a of line.assignments) {
      if (seen.has(a.employeeId)) {
        const empName = employees.find((e) => e.id === a.employeeId)?.name ?? "Thợ";
        return `«${svcName}»: thợ «${empName}» được chọn trùng. Mỗi thợ chỉ gán một lần cho một dịch vụ.`;
      }
      seen.add(a.employeeId);
    }
  }
  return null;
}
