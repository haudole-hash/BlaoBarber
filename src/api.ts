import type {
  DashboardMode,
  DashboardStats,
  Depreciation,
  Employee,
  Order,
  OrderStatus,
  PayrollWorkLogResponse,
  ProfitReportResponse,
  Service,
  ServiceRolePointRow,
  ServiceStats,
  StaffRole,
  TrashCategoryId,
  TrashResponse,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Không thể kết nối máy chủ");
  }
  return res.json() as Promise<T>;
}

export const api = {
  dashboard: (params?: {
    mode?: DashboardMode;
    date?: string;
    month?: string;
    from?: string;
    to?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.mode) q.set("mode", params.mode);
    if (params?.date) q.set("date", params.date);
    if (params?.month) q.set("month", params.month);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return request<DashboardStats>(`/api/dashboard${qs ? `?${qs}` : ""}`);
  },

  services: {
    list: (search?: string) =>
      request<Service[]>(`/api/services${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    stats: () => request<ServiceStats>("/api/services/stats"),
    create: (body: Partial<Service>) =>
      request<Service>("/api/services", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Service>) =>
      request<Service>(`/api/services/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) => request<{ ok: boolean }>(`/api/services/${id}`, { method: "DELETE" }),
  },

  serviceCategories: {
    list: () =>
      request<{ categories: { name: string; serviceCount: number }[] }>("/api/service-categories"),
    create: (name: string) =>
      request<{ ok: boolean; name: string }>("/api/service-categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    remove: (name: string) =>
      request<{ ok: boolean }>(
        `/api/service-categories/${encodeURIComponent(name)}`,
        { method: "DELETE" }
      ),
  },

  orders: {
    list: (params?: { status?: OrderStatus; search?: string; today?: boolean; date?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.search) q.set("search", params.search);
      if (params?.today) q.set("today", "1");
      if (params?.date) q.set("date", params.date);
      const qs = q.toString();
      return request<Order[]>(`/api/orders${qs ? `?${qs}` : ""}`);
    },
    create: (body: Record<string, unknown>) =>
      request<Order>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: Record<string, unknown>) =>
      request<Order>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    cancel: (id: number) => request<{ ok: boolean; removedRevenue?: number }>(`/api/orders/${id}`, { method: "DELETE" }),
    clearHeld: () => request<{ ok: boolean }>("/api/orders/held/clear", { method: "DELETE" }),
  },

  staffRoles: {
    list: () => request<StaffRole[]>("/api/staff-roles"),
    listAll: () =>
      request<(StaffRole & { employee_count?: number })[]>("/api/staff-roles/all"),
    create: (body: { name: string; sort_order?: number }) =>
      request<StaffRole>("/api/staff-roles", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: Partial<StaffRole>) =>
      request<StaffRole>(`/api/staff-roles/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) =>
      request<{ ok: boolean }>(`/api/staff-roles/${id}`, { method: "DELETE" }),
  },

  employees: {
    list: () => request<Employee[]>("/api/employees"),
    listAll: () => request<Employee[]>("/api/employees/all"),
    create: (body: { name: string; role_id: number; salary_coefficient: number }) =>
      request<Employee>("/api/employees", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Employee>) =>
      request<Employee>(`/api/employees/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) =>
      request<{ ok: boolean }>(`/api/employees/${id}`, { method: "DELETE" }),
  },

  serviceRolePoints: {
    get: (serviceId: number) => request<ServiceRolePointRow[]>(`/api/services/${serviceId}/role-points`),
    save: (serviceId: number, points: { role_id: number; points: number }[]) =>
      request<{ ok: boolean }>(`/api/services/${serviceId}/role-points`, {
        method: "PUT",
        body: JSON.stringify({ points }),
      }),
  },

  maintenance: {
    previewOrders: (from: string, to: string) =>
      request<{
        from: string;
        to: string;
        total: number;
        completed: number;
        cancelled: number;
        revenue: number;
        activeInProgress: number;
        activeHeld: number;
      }>(`/api/maintenance/orders/preview?from=${from}&to=${to}`),
    purgeOrders: (body: { from: string; to: string; confirm: string }) =>
      request<{ ok: boolean; deleted: number }>("/api/maintenance/orders/purge", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    deletableEmployees: () =>
      request<
        { id: number; name: string; role_name: string; is_active: number; salary_coefficient: number }[]
      >("/api/maintenance/employees/deletable"),
    purgeEmployees: (body: { ids: number[]; confirm: string }) =>
      request<{ ok: boolean; deleted: number }>("/api/maintenance/employees/purge", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    previewDepreciations: (from: string, to: string) =>
      request<{ from: string; to: string; total: number; totalAmount: number }>(
        `/api/maintenance/depreciations/preview?from=${from}&to=${to}`
      ),
    purgeDepreciations: (body: { from: string; to: string; confirm: string }) =>
      request<{ ok: boolean; deleted: number }>("/api/maintenance/depreciations/purge", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  depreciations: {
    list: (params?: { from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to);
      const qs = q.toString();
      return request<{ rows: Depreciation[]; from?: string; to?: string }>(
        `/api/depreciations${qs ? `?${qs}` : ""}`
      );
    },
    create: (body: { name: string; amount: number; description?: string; expense_date: string }) =>
      request<Depreciation>("/api/depreciations", { method: "POST", body: JSON.stringify(body) }),
    update: (
      id: number,
      body: Partial<Pick<Depreciation, "name" | "amount" | "description" | "expense_date">>
    ) => request<Depreciation>(`/api/depreciations/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) => request<{ ok: boolean }>(`/api/depreciations/${id}`, { method: "DELETE" }),
  },

  trash: {
    list: () => request<TrashResponse>("/api/trash"),
    restore: (category: TrashCategoryId, id: number) =>
      request<{ ok: boolean }>("/api/trash/restore", {
        method: "POST",
        body: JSON.stringify({ category, id }),
      }),
    purge: (category: TrashCategoryId, confirm: string) =>
      request<{ ok: boolean; deleted: number; skipped: number }>("/api/trash/purge", {
        method: "POST",
        body: JSON.stringify({ category, confirm }),
      }),
  },

  profit: {
    report: (from: string, to: string) =>
      request<ProfitReportResponse>(`/api/profit?from=${from}&to=${to}`),
  },

  payroll: {
    settings: () => request<{ point_rate_vnd: number }>("/api/payroll/settings"),
    updateSettings: (point_rate_vnd: number) =>
      request<{ point_rate_vnd: number }>("/api/payroll/settings", {
        method: "PUT",
        body: JSON.stringify({ point_rate_vnd }),
      }),
    workLog: (params: { from: string; to?: string; employee_id?: number }) => {
      const q = new URLSearchParams({ from: params.from });
      if (params.to) q.set("to", params.to);
      if (params.employee_id) q.set("employee_id", String(params.employee_id));
      return request<PayrollWorkLogResponse>(`/api/payroll/work-log?${q}`);
    },
  },
};
