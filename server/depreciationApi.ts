import type { Express } from "express";
import { parseDateParam, parseDateRange } from "./dashboardHelpers.js";
import { db, type DepreciationRow } from "./database.js";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseExpenseDate(value: unknown) {
  const s = String(value ?? "").trim();
  if (isIsoDate(s)) return s;
  // fallback: keep consistent with dashboard date behavior
  return parseDateParam(s);
}

import { recomputeProfitDay } from "./profitApi.js";

export function registerDepreciationRoutes(app: Express) {
  app.get("/api/depreciations", (req, res) => {
    const fromRaw = String(req.query.from ?? "").trim();
    const toRaw = String(req.query.to ?? "").trim();

    if (fromRaw || toRaw) {
      const { from, to } = parseDateRange(fromRaw, toRaw);
      const rows = db
        .prepare(
          `SELECT * FROM depreciations
           WHERE is_active = 1 AND expense_date >= ? AND expense_date <= ?
           ORDER BY expense_date DESC, id DESC`
        )
        .all(from, to) as DepreciationRow[];
      res.json({ from, to, rows });
      return;
    }

    const rows = db
      .prepare(
        `SELECT * FROM depreciations WHERE is_active = 1 ORDER BY expense_date DESC, id DESC LIMIT 500`
      )
      .all() as DepreciationRow[];
    res.json({ rows });
  });

  app.post("/api/depreciations", (req, res) => {
    const name = String(req.body.name ?? "").trim();
    const amount = Number(req.body.amount ?? 0);
    const description = String(req.body.description ?? "").trim();
    const expense_date = parseExpenseDate(req.body.expense_date);

    if (!name) {
      res.status(400).json({ error: "Vui lòng nhập tên khấu hao" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Giá khấu hao phải > 0" });
      return;
    }
    if (!isIsoDate(expense_date)) {
      res.status(400).json({ error: "Ngày không hợp lệ (YYYY-MM-DD)" });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO depreciations (name, amount, description, expense_date)
         VALUES (?, ?, ?, ?)`
      )
      .run(name, amount, description || null, expense_date);

    const row = db
      .prepare("SELECT * FROM depreciations WHERE id = ?")
      .get(result.lastInsertRowid) as DepreciationRow;
    res.status(201).json(row);
  });

  app.put("/api/depreciations/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID không hợp lệ" });
      return;
    }

    const existing = db
      .prepare("SELECT * FROM depreciations WHERE id = ?")
      .get(id) as DepreciationRow | undefined;
    if (!existing) {
      res.status(404).json({ error: "Không tìm thấy khấu hao" });
      return;
    }

    const name = String(req.body.name ?? existing.name).trim();
    const amount = Number(req.body.amount ?? existing.amount);
    const description = String(req.body.description ?? existing.description ?? "").trim();
    const expense_date = parseExpenseDate(req.body.expense_date ?? existing.expense_date);

    if (!name) {
      res.status(400).json({ error: "Vui lòng nhập tên khấu hao" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Giá khấu hao phải > 0" });
      return;
    }
    if (!isIsoDate(expense_date)) {
      res.status(400).json({ error: "Ngày không hợp lệ (YYYY-MM-DD)" });
      return;
    }

    db.prepare(
      `UPDATE depreciations
       SET name = ?, amount = ?, description = ?, expense_date = ?
       WHERE id = ?`
    ).run(name, amount, description || null, expense_date, id);

    const row = db.prepare("SELECT * FROM depreciations WHERE id = ?").get(id) as DepreciationRow;
    res.json(row);
  });

  app.delete("/api/depreciations/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID không hợp lệ" });
      return;
    }
    const existing = db
      .prepare("SELECT * FROM depreciations WHERE id = ?")
      .get(id) as DepreciationRow | undefined;
    if (!existing) {
      res.status(404).json({ error: "Không tìm thấy khấu hao" });
      return;
    }
    if (existing.is_active === 0) {
      res.status(400).json({ error: "Khấu hao đã nằm trong thùng rác" });
      return;
    }
    db.prepare("UPDATE depreciations SET is_active = 0 WHERE id = ?").run(id);
    recomputeProfitDay(existing.expense_date);
    res.json({ ok: true });
  });
}

