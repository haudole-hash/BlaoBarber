import type { Express } from "express";
import { parseDateRange } from "./dashboardHelpers.js";
import { db, type OrderRow } from "./database.js";
import { recomputeProfitDay } from "./profitApi.js";

const PURGE_STATUSES = ["completed", "cancelled"] as const;

function orderActivityDateSql() {
  return "date(COALESCE(completed_at, created_at))";
}

function findOrdersInRange(from: string, to: string, statuses: string[]) {
  const placeholders = statuses.map(() => "?").join(", ");
  return db
    .prepare(
      `SELECT * FROM orders
       WHERE status IN (${placeholders})
         AND ${orderActivityDateSql()} >= ?
         AND ${orderActivityDateSql()} <= ?`
    )
    .all(...statuses, from, to) as OrderRow[];
}

export function registerDataMaintenanceRoutes(app: Express) {
  app.get("/api/maintenance/orders/preview", (req, res) => {
    const { from, to } = parseDateRange(req.query.from, req.query.to);
    const rows = findOrdersInRange(from, to, [...PURGE_STATUSES]);

    const byStatus = { completed: 0, cancelled: 0 };
    let revenue = 0;
    for (const row of rows) {
      if (row.status === "completed") {
        byStatus.completed += 1;
        revenue += row.amount;
      } else if (row.status === "cancelled") {
        byStatus.cancelled += 1;
      }
    }

    const activeCounts = db
      .prepare(
        `SELECT status, COUNT(*) as c FROM orders WHERE status IN ('in_progress', 'held') GROUP BY status`
      )
      .all() as { status: string; c: number }[];

    res.json({
      from,
      to,
      total: rows.length,
      completed: byStatus.completed,
      cancelled: byStatus.cancelled,
      toTrash: byStatus.completed,
      revenue,
      activeInProgress:
        activeCounts.find((r) => r.status === "in_progress")?.c ?? 0,
      activeHeld: activeCounts.find((r) => r.status === "held")?.c ?? 0,
    });
  });

  app.post("/api/maintenance/orders/purge", (req, res) => {
    const { from, to } = parseDateRange(req.body.from, req.body.to);
    const confirm = String(req.body.confirm ?? "").trim().toUpperCase();
    if (confirm !== "XOA") {
      res.status(400).json({ error: 'Gõ chữ XOA (in hoa) để xác nhận xóa' });
      return;
    }

    const rows = findOrdersInRange(from, to, ["completed"]);
    if (rows.length === 0) {
      res.json({ ok: true, deleted: 0, movedToTrash: 0 });
      return;
    }

    const datesToRecompute = new Set<string>();
    const cancelStmt = db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?");
    for (const row of rows) {
      cancelStmt.run(row.id);
      if (row.completed_at) {
        datesToRecompute.add(String(row.completed_at).slice(0, 10));
      }
    }
    for (const d of datesToRecompute) {
      recomputeProfitDay(d);
    }

    res.json({
      ok: true,
      deleted: rows.length,
      movedToTrash: rows.length,
      from,
      to,
    });
  });

  app.get("/api/maintenance/depreciations/preview", (req, res) => {
    const { from, to } = parseDateRange(req.query.from, req.query.to);
    const row = db
      .prepare(
        `SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as s
         FROM depreciations
         WHERE is_active = 1 AND expense_date >= ? AND expense_date <= ?`
      )
      .get(from, to) as { c: number; s: number };

    res.json({
      from,
      to,
      total: row?.c ?? 0,
      totalAmount: row?.s ?? 0,
    });
  });

  app.post("/api/maintenance/depreciations/purge", (req, res) => {
    const { from, to } = parseDateRange(req.body.from, req.body.to);
    const confirm = String(req.body.confirm ?? "").trim().toUpperCase();
    if (confirm !== "XOA") {
      res.status(400).json({ error: 'Gõ chữ XOA (in hoa) để xác nhận xóa' });
      return;
    }

    const dates = db
      .prepare(
        `SELECT DISTINCT expense_date as d FROM depreciations
         WHERE is_active = 1 AND expense_date >= ? AND expense_date <= ?`
      )
      .all(from, to) as { d: string }[];

    const result = db
      .prepare(
        `UPDATE depreciations SET is_active = 0
         WHERE is_active = 1 AND expense_date >= ? AND expense_date <= ?`
      )
      .run(from, to);

    for (const { d } of dates) {
      recomputeProfitDay(d);
    }

    res.json({ ok: true, deleted: result.changes, movedToTrash: result.changes, from, to });
  });

  app.get("/api/maintenance/employees/deletable", (_req, res) => {
    const rows = db
      .prepare(
        `SELECT e.*, r.name as role_name
         FROM employees e
         JOIN staff_roles r ON r.id = e.role_id
         WHERE e.is_active = 1
         ORDER BY e.name`
      )
      .all() as {
      id: number;
      name: string;
      role_name: string;
      is_active: number;
      salary_coefficient: number;
    }[];

    res.json(
      rows.map((e) => ({
        id: e.id,
        name: e.name,
        role_name: e.role_name,
        is_active: e.is_active,
        salary_coefficient: e.salary_coefficient,
      }))
    );
  });

  app.post("/api/maintenance/employees/purge", (req, res) => {
    const confirm = String(req.body.confirm ?? "").trim().toUpperCase();
    if (confirm !== "XOA") {
      res.status(400).json({ error: 'Gõ chữ XOA (in hoa) để xác nhận xóa' });
      return;
    }

    const ids = Array.isArray(req.body.ids)
      ? req.body.ids.map((id: unknown) => Number(id)).filter((id) => id > 0)
      : [];
    if (ids.length === 0) {
      res.status(400).json({ error: "Chọn ít nhất một nhân viên" });
      return;
    }

    let moved = 0;
    const hideStmt = db.prepare(
      "UPDATE employees SET is_active = 0 WHERE id = ? AND is_active = 1"
    );
    for (const id of ids) {
      const r = hideStmt.run(id);
      moved += r.changes;
    }

    res.json({ ok: true, deleted: moved, movedToTrash: moved });
  });
}
