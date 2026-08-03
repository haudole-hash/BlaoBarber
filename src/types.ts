export type OrderStatus = "in_progress" | "held" | "completed" | "cancelled";

export interface OrderAssignment {
  employee_id: number;
  role_id: number;
  employee_name?: string;
  role_name?: string;
  points?: number;
  earnings?: number;
  is_proxy?: boolean;
}

export interface OrderLineItem {
  service_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  assignments?: OrderAssignment[];
  shop_percent?: number;
  shop_cut?: number;
  has_proxy?: boolean;
}

export interface StaffRole {
  id: number;
  name: string;
  sort_order: number;
  is_active: number;
  is_proxy_owner?: number;
}

export interface Employee {
  id: number;
  name: string;
  role_id: number;
  role_name?: string;
  salary_coefficient: number;
  is_active: number;
  created_at: string;
  /** Số dòng đơn (mọi trạng thái) có gán nhân viên này */
  order_usage_count?: number;
}

export interface ServiceRolePointRow {
  role_id: number;
  role_name: string;
  points: number;
}

export interface WorkLogEntry {
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
  is_proxy?: boolean;
}

export interface PayrollWorkLogResponse {
  from: string;
  to: string;
  point_rate_vnd: number;
  entries: WorkLogEntry[];
  summaries: {
    employee_id: number;
    employee_name: string;
    total_points: number;
    total_earnings: number;
    entries: WorkLogEntry[];
  }[];
}

export interface Service {
  id: number;
  name: string;
  category: string;
  duration_minutes: number | null;
  price: number;
  /** % chu gia lap tra lai quan */
  shop_percent?: number;
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
  /** Doanh thu quan (bill proxy = phan Tiem %) */
  shop_revenue?: number;
  has_proxy?: boolean;
  discount_percent?: number;
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

export interface Depreciation {
  id: number;
  name: string;
  amount: number;
  description: string | null;
  expense_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface ProfitDayRow {
  date: string;
  profit: number;
  revenue: number;
  payroll: number;
  depreciation: number;
}

export interface ProfitReportResponse {
  from: string;
  to: string;
  days: ProfitDayRow[];
  totals: {
    revenue: number;
    payroll: number;
    depreciation: number;
    profit: number;
  };
}

export type TrashCategoryId =
  | "orders"
  | "services"
  | "employees"
  | "staff_roles"
  | "depreciations";

export interface TrashItem {
  id: number;
  label: string;
  sublabel?: string;
  meta?: string;
}

export interface TrashCategory {
  id: TrashCategoryId;
  title: string;
  count: number;
  items: TrashItem[];
}

export interface TrashResponse {
  total: number;
  categories: TrashCategory[];
}
