import type { Express } from "express";
import { parseDateRange } from "./dashboardHelpers.js";
import { db, type EmployeeRow, type OrderRow, type StaffRoleRow } from "./database.js";
import { sumOrderRevenue } from "./orderHelpers.js";
import { collectWorkLogFromOrders, sumShopPayroll } from "./payrollHelpers.js";

function listDatesInRange(from: string, to: string) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const out: string[] = [];
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
  }
  return out;
}

function groupOrdersByDay(rows: OrderRow[]) {
  const map = new Map<string, OrderRow[]>();
  for (const row of rows) {
    if (!row.completed_at) continue;
    const day = String(row.completed_at).slice(0, 10);
    const list = map.get(day) ?? [];
    list.push(row);
    map.set(day, list);
  }
  return map;
}

/** Cap nhat bang profit_daily cho mot ngay sau khi xoa/huy don da thu */
export function recomputeProfitDay(date: string) {
  const orderRows = db
    .prepare(
      `SELECT * FROM orders
       WHERE status = 'completed'
         AND completed_at IS NOT NULL
         AND date(completed_at) = ?`
    )
    .all(date) as OrderRow[];

  const employees = db.prepare("SELECT * FROM employees").all() as EmployeeRow[];
  const roles = db.prepare("SELECT * FROM staff_roles").all() as StaffRoleRow[];
  const employeesById = new Map(employees.map((e) => [e.id, e]));
  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const payrollEntries = collectWorkLogFromOrders(orderRows, employeesById, rolesById);

  const depreciationRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as s FROM depreciations WHERE is_active = 1 AND expense_date = ?`
    )
    .get(date) as { s: number };

  const revenue = sumOrderRevenue(orderRows);
  const payroll = sumShopPayroll(payrollEntries);
  const depreciation = Number(depreciationRow.s) || 0;
  const profit = revenue - payroll - depreciation;

  db.prepare(
    `INSERT INTO profit_daily (profit_date, revenue, payroll, depreciation, profit)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(profit_date) DO UPDATE SET
       revenue = excluded.revenue,
       payroll = excluded.payroll,
       depreciation = excluded.depreciation,
       profit = excluded.profit`
  ).run(date, revenue, payroll, depreciation, profit);
}

export function registerProfitRoutes(app: Express) {
  // Doanh thu = tong gia tri don (amount). Loi nhuan = doanh thu - luong - khau hao
  app.get("/api/profit", (req, res) => {
    const { from, to } = parseDateRange(req.query.from, req.query.to);

    const orderRows = db
      .prepare(
        `SELECT * FROM orders
         WHERE status = 'completed'
           AND completed_at IS NOT NULL
           AND date(completed_at) >= ?
           AND date(completed_at) <= ?`
      )
      .all(from, to) as OrderRow[];

    const ordersByDay = groupOrdersByDay(orderRows);

    const employees = db.prepare("SELECT * FROM employees").all() as EmployeeRow[];
    const roles = db.prepare("SELECT * FROM staff_roles").all() as StaffRoleRow[];
    const employeesById = new Map(employees.map((e) => [e.id, e]));
    const rolesById = new Map(roles.map((r) => [r.id, r]));
    const payrollEntries = collectWorkLogFromOrders(orderRows, employeesById, rolesById);

    const depreciationRows = db
      .prepare(
        `SELECT expense_date as d, COALESCE(SUM(amount), 0) as s
         FROM depreciations
         WHERE is_active = 1 AND expense_date >= ? AND expense_date <= ?
         GROUP BY expense_date`
      )
      .all(from, to) as { d: string; s: number }[];

    const depreciationByDay = new Map(depreciationRows.map((r) => [r.d, Number(r.s) || 0]));
    const payrollByDay = new Map<string, number>();
    for (const e of payrollEntries) {
      if (e.is_proxy) continue;
      const day = String(e.completed_at).slice(0, 10);
      payrollByDay.set(day, (payrollByDay.get(day) ?? 0) + (Number(e.earnings) || 0));
    }

    const days = listDatesInRange(from, to).map((date) => {
      const dayOrders = ordersByDay.get(date) ?? [];
      const revenue = sumOrderRevenue(dayOrders);
      const payroll = payrollByDay.get(date) ?? 0;
      const depreciation = depreciationByDay.get(date) ?? 0;
      const profit = revenue - payroll - depreciation;
      return { date, profit, revenue, payroll, depreciation };
    });

    const upsert = db.prepare(
      `INSERT INTO profit_daily (profit_date, revenue, payroll, depreciation, profit)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(profit_date) DO UPDATE SET
         revenue = excluded.revenue,
         payroll = excluded.payroll,
         depreciation = excluded.depreciation,
         profit = excluded.profit`
    );
    for (const d of days) {
      upsert.run(d.date, d.revenue, d.payroll, d.depreciation, d.profit);
    }

    const totals = {
      revenue: sumOrderRevenue(orderRows),
      payroll: days.reduce((s, d) => s + d.payroll, 0),
      depreciation: days.reduce((s, d) => s + d.depreciation, 0),
      profit: days.reduce((s, d) => s + d.profit, 0),
    };

    res.json({ from, to, days, totals });
  });
}
