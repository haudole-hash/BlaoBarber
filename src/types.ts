export type OrderStatus = "in_progress" | "held" | "completed" | "cancelled";

export interface OrderLineItem {
  service_id: number;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface Service {
  id: number;
  name: string;
  category: string;
  duration_minutes: number | null;
  price: number;
  icon: string;
  is_active: number;
  created_at: string;
}

export interface Order {
  id: number;
  customer_name: string;
  barber: string;
  service_id: number | null;
  service_name: string;
  amount: number;
  status: OrderStatus;
  note: string | null;
  items?: OrderLineItem[];
  created_at: string;
  completed_at: string | null;
}

export type DashboardMode = "day" | "month" | "range";

export interface DashboardStats {
  mode: DashboardMode;
  periodLabel: string;
  date?: string;
  month?: string;
  from?: string;
  to?: string;
  isToday?: boolean;
  customerCount: number;
  revenue: number;
  customerGrowthPct: number;
  revenueGrowthPct: number;
  growthCompareLabel: string;
  customerLabel: string;
  revenueLabel: string;
  sessionsSuffix: string;
  emptyMessage: string;
  topService: { name: string; sessions: number } | null;
  serviceStats: { service_name: string; quantity: number; revenue: number }[];
  heldRevenue: number;
}

export interface ServiceStats {
  totalServices: number;
  averagePrice: number;
  mostPopular: { name: string; count: number; durationMinutes: number | null } | null;
}
