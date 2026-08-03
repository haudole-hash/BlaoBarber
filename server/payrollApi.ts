import type { Express } from "express";
import {
  db,
  getPointRateVnd,
  type EmployeeRow,
  type OrderRow,
  type OrderStatus,
  type ServiceRolePointRow,
  type StaffRoleRow,
} from "./database.js";
import {
  buildPointsMap,
  collectWorkLogFromOrders,
  enrichOrderItemsForPayroll,
  primaryBarberLabel,
  type PayrollContext,
} from "./payrollHelpers.js";
import { getOrderItems, type OrderLineItem } from "./orderHelpers.js";
import { parseDateParam, parseDateRange } from "./dashboardHelpers.js";
import { isProxyRole, normalizeRoleName, PROXY_OWNER_ROLE_LABEL } from "./proxyRole.js";

export function buildEmployeeOrderUsageMap(): Map<number, number> {
  const map = new Map<number, number>();
  const rows = db.prepare("SELECT items_json FROM orders WHERE items_json IS NOT NULL").all() as {
    items_json: string;
  }[];
  for (const { items_json } of rows) {
    try {
      const items = JSON.parse(items_json) as { assignments?: { employee_id: number }[] }[];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        for (const a of item.assignments ?? []) {
          const id = Number(a.employee_id);
          if (!id) continue;
          map.set(id, (map.get(id) ?? 0) + 1);
        }
      }
    } catch {
      /* legacy / invalid json */
    }
  }
  return map;
}

function countEmployeeOrderReferences(employeeId: number) {
  return buildEmployeeOrderUsageMap().get(employeeId) ?? 0;
}

export function loadPayrollContext(): PayrollContext {
  const employees = db.prepare("SELECT * FROM employees WHERE is_active = 1").all() as EmployeeRow[];
  const roles = db.prepare("SELECT * FROM staff_roles WHERE is_active = 1 ORDER BY sort_order, name").all() as StaffRoleRow[];
  const points = db.prepare("SELECT * FROM service_role_points").all() as ServiceRolePointRow[];
  const services = db.prepare("SELECT id, shop_percent FROM services").all() as {
    id: number;
    shop_percent: number;
  }[];
  return {
    employeesById: new Map(employees.map((e) => [e.id, e])),
    rolesById: new Map(roles.map((r) => [r.id, r])),
    pointsMap: buildPointsMap(points),
    pointRateVnd: getPointRateVnd(),
    shopPercentByServiceId: new Map(
      services.map((s) => [s.id, Number(s.shop_percent) || 0])
    ),
  };
}

/** Gắn role_id từ hồ sơ nhân viên — không dùng loại thợ chọn tay trên bill */
export function bindAssignmentsToEmployees(
  items: OrderLineItem[],
  employeesById: Map<number, EmployeeRow>
): OrderLineItem[] {
  return items.map((item) => ({
    ...item,
    assignments: item.assignments
      ?.map((a) => {
        const emp = employeesById.get(Number(a.employee_id));
        if (!emp) return null;
        return { employee_id: emp.id, role_id: emp.role_id };
      })
      .filter((a): a is { employee_id: number; role_id: number } => a != null),
  }));
}

export function processLineItemsForOrder(
  lineItems: OrderLineItem[],
  status: OrderStatus
): OrderLineItem[] {
  const ctx = loadPayrollContext();
  if (status === "completed") {
    return enrichOrderItemsForPayroll(lineItems, ctx);
  }
  return lineItems.map((item) => ({
    ...item,
    assignments: item.assignments?.map((a) => {
      const emp = ctx.employeesById.get(a.employee_id);
      const roleId = emp?.role_id ?? a.role_id;
      const role = ctx.rolesById.get(roleId);
      return {
        ...a,
        role_id: roleId,
        employee_name: emp?.name ?? a.employee_name,
        role_name: role?.name ?? a.role_name,
        is_proxy: isProxyRole(role),
      };
    }),
  }));
}

export function registerPayrollRoutes(app: Express) {
  app.get("/api/staff-roles", (_req, res) => {
    const rows = db
      .prepare("SELECT * FROM staff_roles WHERE is_active = 1 ORDER BY sort_order, name")
      .all();
    res.json(rows);
  });

  app.get("/api/staff-roles/all", (_req, res) => {
    const rows = db
      .prepare(
        `SELECT r.*,
          (SELECT COUNT(*) FROM employees e WHERE e.role_id = r.id AND e.is_active = 1) as employee_count
         FROM staff_roles r
         ORDER BY r.sort_order, r.name`
      )
      .all();
    res.json(rows);
  });

  app.post("/api/staff-roles", (req, res) => {
    const { name, sort_order } = req.body;
    const trimmed = String(name ?? "").trim();
    if (!trimmed) {
      res.status(400).json({ error: "Tên loại thợ là bắt buộc" });
      return;
    }
    const proxyFlag = normalizeRoleName(trimmed) === normalizeRoleName(PROXY_OWNER_ROLE_LABEL) ? 1 : 0;
    const existing = db.prepare("SELECT * FROM staff_roles WHERE name = ?").get(trimmed) as
      | StaffRoleRow
      | undefined;
    if (existing) {
      if (existing.is_active === 0) {
        db.prepare(
          "UPDATE staff_roles SET is_active = 1, sort_order = ?, is_proxy_owner = ? WHERE id = ?"
        ).run(sort_order ?? existing.sort_order, proxyFlag || existing.is_proxy_owner, existing.id);
        res.json(db.prepare("SELECT * FROM staff_roles WHERE id = ?").get(existing.id));
        return;
      }
      res.status(400).json({ error: `Loại thợ "${trimmed}" đã có sẵn` });
      return;
    }
    const result = db
      .prepare("INSERT INTO staff_roles (name, sort_order, is_proxy_owner) VALUES (?, ?, ?)")
      .run(trimmed, sort_order ?? 0, proxyFlag);
    res.status(201).json(db.prepare("SELECT * FROM staff_roles WHERE id = ?").get(result.lastInsertRowid));
  });

  app.put("/api/staff-roles/:id", (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare("SELECT * FROM staff_roles WHERE id = ?").get(id);
    if (!row) {
      res.status(404).json({ error: "Không tìm thấy loại thợ" });
      return;
    }
    const { name, sort_order, is_active } = req.body;
    const nextName = name ?? (row as StaffRoleRow).name;
    const nextActive = is_active ?? (row as StaffRoleRow).is_active;
    if (nextActive === 0 && (row as StaffRoleRow).is_active === 1) {
      const used = db
        .prepare("SELECT COUNT(*) as c FROM employees WHERE role_id = ? AND is_active = 1")
        .get(id) as { c: number };
      if (used.c > 0) {
        res.status(400).json({
          error: `Không thể ẩn loại thợ — còn ${used.c} nhân viên đang dùng`,
        });
        return;
      }
    }
    const proxyFlag =
      normalizeRoleName(String(nextName)) === normalizeRoleName(PROXY_OWNER_ROLE_LABEL)
        ? 1
        : Number((row as StaffRoleRow).is_proxy_owner) === 1
          ? 1
          : 0;
    db.prepare(
      "UPDATE staff_roles SET name = ?, sort_order = ?, is_active = ?, is_proxy_owner = ? WHERE id = ?"
    ).run(
      nextName,
      sort_order ?? (row as StaffRoleRow).sort_order,
      nextActive,
      proxyFlag,
      id
    );
    res.json(db.prepare("SELECT * FROM staff_roles WHERE id = ?").get(id));
  });

  app.delete("/api/staff-roles/:id", (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare("SELECT * FROM staff_roles WHERE id = ?").get(id) as StaffRoleRow | undefined;
    if (!row) {
      res.status(404).json({ error: "Không tìm thấy loại thợ" });
      return;
    }
    if (row.is_active === 0) {
      res.status(400).json({ error: "Loại thợ đã nằm trong thùng rác" });
      return;
    }
    const used = db.prepare("SELECT COUNT(*) as c FROM employees WHERE role_id = ? AND is_active = 1").get(id) as {
      c: number;
    };
    if (used.c > 0) {
      res.status(400).json({
        error: `Không thể xóa loại thợ — còn ${used.c} nhân viên đang dùng`,
      });
      return;
    }
    db.prepare("UPDATE staff_roles SET is_active = 0 WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  app.get("/api/employees", (_req, res) => {
    const usage = buildEmployeeOrderUsageMap();
    const rows = db
      .prepare(
        `SELECT e.*, r.name as role_name
         FROM employees e
         JOIN staff_roles r ON r.id = e.role_id
         WHERE e.is_active = 1
         ORDER BY e.name`
      )
      .all() as { id: number }[];
    res.json(rows.map((r) => ({ ...r, order_usage_count: usage.get(r.id) ?? 0 })));
  });

  app.get("/api/employees/all", (_req, res) => {
    const usage = buildEmployeeOrderUsageMap();
    const rows = db
      .prepare(
        `SELECT e.*, r.name as role_name
         FROM employees e
         JOIN staff_roles r ON r.id = e.role_id
         ORDER BY e.is_active DESC, e.name`
      )
      .all() as { id: number }[];
    res.json(rows.map((r) => ({ ...r, order_usage_count: usage.get(r.id) ?? 0 })));
  });

  app.post("/api/employees", (req, res) => {
    const { name, role_id, salary_coefficient } = req.body;
    if (!name?.trim() || !role_id) {
      res.status(400).json({ error: "Tên và loại thợ là bắt buộc" });
      return;
    }
    const result = db
      .prepare(
        `INSERT INTO employees (name, role_id, salary_coefficient) VALUES (?, ?, ?)`
      )
      .run(name.trim(), Number(role_id), Number(salary_coefficient) || 1);
    const id = result.lastInsertRowid;
    res.status(201).json(
      db
        .prepare(
          `SELECT e.*, r.name as role_name FROM employees e JOIN staff_roles r ON r.id = e.role_id WHERE e.id = ?`
        )
        .get(id)
    );
  });

  app.put("/api/employees/:id", (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(id) as EmployeeRow | undefined;
    if (!row) {
      res.status(404).json({ error: "Không tìm thấy nhân viên" });
      return;
    }
    const { name, role_id, salary_coefficient, is_active } = req.body;
    db.prepare(
      `UPDATE employees SET name = ?, role_id = ?, salary_coefficient = ?, is_active = ? WHERE id = ?`
    ).run(
      name ?? row.name,
      role_id ?? row.role_id,
      salary_coefficient ?? row.salary_coefficient,
      is_active ?? row.is_active,
      id
    );
    res.json(
      db
        .prepare(
          `SELECT e.*, r.name as role_name FROM employees e JOIN staff_roles r ON r.id = e.role_id WHERE e.id = ?`
        )
        .get(id)
    );
  });

  app.delete("/api/employees/:id", (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(id) as EmployeeRow | undefined;
    if (!row) {
      res.status(404).json({ error: "Không tìm thấy nhân viên" });
      return;
    }
    if (row.is_active === 0) {
      res.status(400).json({ error: "Nhân viên đã nằm trong thùng rác" });
      return;
    }
    db.prepare("UPDATE employees SET is_active = 0 WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  app.get("/api/services/:id/role-points", (req, res) => {
    const serviceId = Number(req.params.id);
    const roles = db
      .prepare(
        `SELECT * FROM staff_roles
         WHERE is_active = 1 AND COALESCE(is_proxy_owner, 0) = 0
         ORDER BY sort_order, name`
      )
      .all() as StaffRoleRow[];
    const points = db
      .prepare("SELECT role_id, points FROM service_role_points WHERE service_id = ?")
      .all(serviceId) as { role_id: number; points: number }[];
    const byRole = new Map(points.map((p) => [p.role_id, p.points]));
    res.json(
      roles.map((r) => ({
        role_id: r.id,
        role_name: r.name,
        points: byRole.get(r.id) ?? 0,
      }))
    );
  });

  app.put("/api/services/:id/role-points", (req, res) => {
    const serviceId = Number(req.params.id);
    const svc = db.prepare("SELECT id FROM services WHERE id = ?").get(serviceId);
    if (!svc) {
      res.status(404).json({ error: "Không tìm thấy dịch vụ" });
      return;
    }
    const list = req.body.points as { role_id: number; points: number }[] | undefined;
    if (!Array.isArray(list)) {
      res.status(400).json({ error: "Thiếu danh sách điểm" });
      return;
    }
    const upsert = db.prepare(
      `INSERT INTO service_role_points (service_id, role_id, points) VALUES (?, ?, ?)
       ON CONFLICT(service_id, role_id) DO UPDATE SET points = excluded.points`
    );
    for (const p of list) {
      upsert.run(serviceId, Number(p.role_id), Math.max(0, Number(p.points) || 0));
    }
    res.json({ ok: true });
  });

  app.get("/api/payroll/settings", (_req, res) => {
    res.json({ point_rate_vnd: getPointRateVnd() });
  });

  app.put("/api/payroll/settings", (req, res) => {
    const rate = Number(req.body.point_rate_vnd);
    if (!Number.isFinite(rate) || rate <= 0) {
      res.status(400).json({ error: "Đơn giá điểm không hợp lệ" });
      return;
    }
    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('point_rate_vnd', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(String(rate));
    res.json({ point_rate_vnd: rate });
  });

  app.get("/api/payroll/work-log", (req, res) => {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to ?? req.query.from);
    const employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;

    const rows = db
      .prepare(
        `SELECT * FROM orders
         WHERE status = 'completed'
           AND date(completed_at) >= ?
           AND date(completed_at) <= ?`
      )
      .all(from, to) as OrderRow[];

    const ctx = loadPayrollContext();
    let log = collectWorkLogFromOrders(rows, ctx.employeesById, ctx.rolesById);
    if (employeeId) {
      log = log.filter((e) => e.employee_id === employeeId);
    }

    const byEmployee = new Map<
      number,
      { employee_id: number; employee_name: string; total_points: number; total_earnings: number; entries: typeof log }
    >();
    for (const e of log) {
      const cur = byEmployee.get(e.employee_id) ?? {
        employee_id: e.employee_id,
        employee_name: e.employee_name,
        total_points: 0,
        total_earnings: 0,
        entries: [],
      };
      cur.total_points += e.points;
      cur.total_earnings += e.earnings;
      cur.entries.push(e);
      byEmployee.set(e.employee_id, cur);
    }

    res.json({
      from,
      to,
      point_rate_vnd: ctx.pointRateVnd,
      entries: log,
      summaries: [...byEmployee.values()].sort((a, b) => b.total_earnings - a.total_earnings),
    });
  });
}
