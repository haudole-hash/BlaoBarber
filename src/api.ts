import type { DashboardMode, DashboardStats, Order, OrderStatus, Service, ServiceStats } from "./types";

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

  orders: {
    list: (params?: { status?: OrderStatus; search?: string; today?: boolean }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.search) q.set("search", params.search);
      if (params?.today) q.set("today", "1");
      const qs = q.toString();
      return request<Order[]>(`/api/orders${qs ? `?${qs}` : ""}`);
    },
    create: (body: Record<string, unknown>) =>
      request<Order>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: Record<string, unknown>) =>
      request<Order>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    cancel: (id: number) => request<{ ok: boolean }>(`/api/orders/${id}`, { method: "DELETE" }),
    clearHeld: () => request<{ ok: boolean }>("/api/orders/held/clear", { method: "DELETE" }),
  },
};
