import type { Express } from "express";
import { db, type DepreciationRow, type EmployeeRow, type OrderRow, type ServiceRow, type StaffRoleRow } from "./database.js";
import { orderRevenueAmount, serializeOrder } from "./orderHelpers.js";
import { buildEmployeeOrderUsageMap } from "./payrollApi.js";
import { recomputeProfitDay } from "./profitApi.js";

export const TRASH_CATEGORIES = [
  "orders",
  "services",
  "employees",
  "staff_roles",
  "depreciations",
] as const;

export type TrashCategoryId = (typeof TRASH_CATEGORIES)[number];

function isTrashCategory(v: string): v is TrashCategoryId {
  return (TRASH_CATEGORIES as readonly string[]).includes(v);
}

function listTrashOrders() {
  const rows = db
    .prepare(
      `SELECT * FROM orders WHERE status = 'cancelled'
       ORDER BY COALESCE(completed_at, created_at) DESC LIMIT 500`
    )
    .all() as OrderRow[];
  return rows.map((row) => {
    const o = serializeOrder(row);
    return {
      id: row.id,
      label: `#${row.id} · ${o.customer_name}`,
      sublabel: o.service_name,
      meta: orderRevenueAmount(row) > 0 ? `${orderRevenueAmount(row)}` : undefined,
      amount: orderRevenueAmount(row),
      completed_at: row.completed_at,
      created_at: row.created_at,
    };
  });
}

function listTrashServices() {
  const rows = db
    .prepare("SELECT * FROM services WHERE is_active = 0 ORDER BY name LIMIT 500")
    .all() as ServiceRow[];
  return rows.map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: s.category,
    meta: String(s.price),
  }));
}

function listTrashEmployees() {
  const usage = buildEmployeeOrderUsageMap();
  const rows = db
    .prepare(
      `SELECT e.*, r.name as role_name
       FROM employees e
       JOIN staff_roles r ON r.id = e.role_id
       WHERE e.is_active = 0
       ORDER BY e.name`
    )
    .all() as (EmployeeRow & { role_name: string })[];
  return rows.map((e) => ({
    id: e.id,
    label: e.name,
    sublabel: e.role_name,
    meta: (usage.get(e.id) ?? 0) > 0 ? `Đã có trong ${usage.get(e.id)} dòng đơn` : undefined,
    order_usage_count: usage.get(e.id) ?? 0,
  }));
}

function listTrashStaffRoles() {
  const rows = db
    .prepare(
      `SELECT r.*,
        (SELECT COUNT(*) FROM employees e WHERE e.role_id = r.id) as employee_count
       FROM staff_roles r
       WHERE r.is_active = 0
       ORDER BY r.sort_order, r.name`
    )
    .all() as (StaffRoleRow & { employee_count: number })[];
  return rows.map((r) => ({
    id: r.id,
    label: r.name,
    sublabel: r.employee_count > 0 ? `${r.employee_count} nhân viên` : undefined,
    employee_count: r.employee_count,
  }));
}

function listTrashDepreciations() {
  const rows = db
    .prepare(
      `SELECT * FROM depreciations WHERE is_active = 0
       ORDER BY expense_date DESC, id DESC LIMIT 500`
    )
    .all() as DepreciationRow[];
  return rows.map((d) => ({
    id: d.id,
    label: d.name,
    sublabel: d.expense_date,
    meta: String(d.amount),
    expense_date: d.expense_date,
  }));
}

function restoreOrder(id: number) {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!row || row.status !== "cancelled") {
    return { error: "Không tìm thấy đơn trong thùng rác" };
  }
  const nextStatus = row.completed_at ? "completed" : "held";
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(nextStatus, id);
  if (row.completed_at) {
    recomputeProfitDay(String(row.completed_at).slice(0, 10));
  }
  return { ok: true };
}

function restoreService(id: number) {
  const row = db.prepare("SELECT * FROM services WHERE id = ?").get(id) as ServiceRow | undefined;
  if (!row || row.is_active !== 0) return { error: "Không tìm thấy dịch vụ trong thùng rác" };
  db.prepare("UPDATE services SET is_active = 1 WHERE id = ?").run(id);
  return { ok: true };
}

function restoreEmployee(id: number) {
  const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(id) as EmployeeRow | undefined;
  if (!row || row.is_active !== 0) return { error: "Không tìm thấy nhân viên trong thùng rác" };
  db.prepare("UPDATE employees SET is_active = 1 WHERE id = ?").run(id);
  return { ok: true };
}

function restoreStaffRole(id: number) {
  const row = db.prepare("SELECT * FROM staff_roles WHERE id = ?").get(id) as StaffRoleRow | undefined;
  if (!row || row.is_active !== 0) return { error: "Không tìm thấy loại thợ trong thùng rác" };
  db.prepare("UPDATE staff_roles SET is_active = 1 WHERE id = ?").run(id);
  return { ok: true };
}

function restoreDepreciation(id: number) {
  const row = db
    .prepare("SELECT * FROM depreciations WHERE id = ?")
    .get(id) as DepreciationRow | undefined;
  if (!row || row.is_active !== 0) return { error: "Không tìm thấy khấu hao trong thùng rác" };
  db.prepare("UPDATE depreciations SET is_active = 1 WHERE id = ?").run(id);
  recomputeProfitDay(row.expense_date);
  return { ok: true };
}

function purgeOrders() {
  const r = db.prepare("DELETE FROM orders WHERE status = 'cancelled'").run();
  return { deleted: r.changes, skipped: 0 };
}

function purgeServices() {
  const hidden = db
    .prepare("SELECT id FROM services WHERE is_active = 0")
    .all() as { id: number }[];
  let deleted = 0;
  let skipped = 0;
  const usedStmt = db.prepare("SELECT COUNT(*) as c FROM orders WHERE service_id = ?");
  const delStmt = db.prepare("DELETE FROM services WHERE id = ?");
  for (const { id } of hidden) {
    const used = usedStmt.get(id) as { c: number };
    if (used.c > 0) {
      skipped += 1;
      continue;
    }
    delStmt.run(id);
    deleted += 1;
  }
  return { deleted, skipped };
}

function purgeEmployees() {
  const usage = buildEmployeeOrderUsageMap();
  const hidden = db
    .prepare("SELECT id FROM employees WHERE is_active = 0")
    .all() as { id: number }[];
  let deleted = 0;
  let skipped = 0;
  const delStmt = db.prepare("DELETE FROM employees WHERE id = ?");
  for (const { id } of hidden) {
    if ((usage.get(id) ?? 0) > 0) {
      skipped += 1;
      continue;
    }
    delStmt.run(id);
    deleted += 1;
  }
  return { deleted, skipped };
}

function purgeStaffRoles() {
  const hidden = db
    .prepare("SELECT id FROM staff_roles WHERE is_active = 0")
    .all() as { id: number }[];
  let deleted = 0;
  let skipped = 0;
  const empStmt = db.prepare("SELECT COUNT(*) as c FROM employees WHERE role_id = ?");
  for (const { id } of hidden) {
    const emp = empStmt.get(id) as { c: number };
    if (emp.c > 0) {
      skipped += 1;
      continue;
    }
    db.prepare("DELETE FROM service_role_points WHERE role_id = ?").run(id);
    db.prepare("DELETE FROM staff_roles WHERE id = ?").run(id);
    deleted += 1;
  }
  return { deleted, skipped };
}

function purgeDepreciations() {
  const dates = db
    .prepare("SELECT DISTINCT expense_date as d FROM depreciations WHERE is_active = 0")
    .all() as { d: string }[];
  const r = db.prepare("DELETE FROM depreciations WHERE is_active = 0").run();
  for (const { d } of dates) {
    recomputeProfitDay(d);
  }
  return { deleted: r.changes, skipped: 0 };
}

const CATEGORY_META: Record<
  TrashCategoryId,
  { title: string; purge: () => { deleted: number; skipped: number } }
> = {
  orders: { title: "Đơn hàng đã xóa", purge: purgeOrders },
  services: { title: "Dịch vụ đã xóa", purge: purgeServices },
  employees: { title: "Nhân viên đã xóa", purge: purgeEmployees },
  staff_roles: { title: "Loại thợ đã xóa", purge: purgeStaffRoles },
  depreciations: { title: "Khấu hao đã xóa", purge: purgeDepreciations },
};

function listCategoryItems(id: TrashCategoryId) {
  switch (id) {
    case "orders":
      return listTrashOrders();
    case "services":
      return listTrashServices();
    case "employees":
      return listTrashEmployees();
    case "staff_roles":
      return listTrashStaffRoles();
    case "depreciations":
      return listTrashDepreciations();
  }
}

export function registerTrashRoutes(app: Express) {
  app.get("/api/trash", (_req, res) => {
    const categories = TRASH_CATEGORIES.map((id) => {
      const items = listCategoryItems(id);
      return {
        id,
        title: CATEGORY_META[id].title,
        count: items.length,
        items,
      };
    });
    const total = categories.reduce((s, c) => s + c.count, 0);
    res.json({ total, categories });
  });

  app.post("/api/trash/restore", (req, res) => {
    const category = String(req.body.category ?? "");
    const id = Number(req.body.id);
    if (!isTrashCategory(category) || !id) {
      res.status(400).json({ error: "Yêu cầu không hợp lệ" });
      return;
    }
    let result: { ok?: boolean; error?: string };
    switch (category) {
      case "orders":
        result = restoreOrder(id);
        break;
      case "services":
        result = restoreService(id);
        break;
      case "employees":
        result = restoreEmployee(id);
        break;
      case "staff_roles":
        result = restoreStaffRole(id);
        break;
      case "depreciations":
        result = restoreDepreciation(id);
        break;
    }
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.post("/api/trash/purge", (req, res) => {
    const category = String(req.body.category ?? "");
    const confirm = String(req.body.confirm ?? "").trim().toUpperCase();
    if (!isTrashCategory(category)) {
      res.status(400).json({ error: "Loại thùng rác không hợp lệ" });
      return;
    }
    if (confirm !== "XOA") {
      res.status(400).json({ error: 'Gõ chữ XOA (in hoa) để xác nhận xóa vĩnh viễn' });
      return;
    }
    const items = listCategoryItems(category);
    if (items.length === 0) {
      res.json({ ok: true, deleted: 0, skipped: 0 });
      return;
    }
    const { deleted, skipped } = CATEGORY_META[category].purge();
    res.json({ ok: true, deleted, skipped });
  });
}
