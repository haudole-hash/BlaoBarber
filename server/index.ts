import cors from "cors";
import express from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  formatDateRangeLabel,
  growthPct,
  localDateString,
  localMonthString,
  parseDateParam,
  parseDateRange,
  parseMonthParam,
  previousDay,
  previousMonth,
  previousRange,
  type DashboardMode,
} from "./dashboardHelpers.js";
import { db, dbPath, todayDateSql, type OrderRow, type OrderStatus, type ServiceRow } from "./database.js";
import {
  aggregateServiceStats,
  buildItemsFromInput,
  computeItemsTotal,
  formatItemsSummary,
  serializeOrder,
  topServiceFromStats,
  type OrderItemInput,
} from "./orderHelpers.js";

function resolveAppRoot() {
  if (process.env.BLAO_APP_ROOT) return process.env.BLAO_APP_ROOT;
  if (typeof __filename !== "undefined") return path.join(path.dirname(__filename), "..");
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
}

const appRoot = resolveAppRoot();
const app = express();
const PORT = Number(process.env.PORT) || 3847;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "BLaoBarber" });
});

function openAppInBrowser() {
  if (process.env.BLAO_NO_BROWSER === "1") return;
  const url = `http://127.0.0.1:${PORT}`;
  if (process.platform === "win32") {
    exec(`start "" "${url}"`, { windowsHide: true });
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

// ——— Services ———
app.get("/api/services", (req, res) => {
  const search = String(req.query.search ?? "").trim().toLowerCase();
  let rows = db
    .prepare("SELECT * FROM services WHERE is_active = 1 ORDER BY name")
    .all() as ServiceRow[];

  if (search) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(search) ||
        r.category.toLowerCase().includes(search)
    );
  }
  res.json(rows);
});

app.get("/api/services/stats", (_req, res) => {
  const total = db.prepare("SELECT COUNT(*) as c FROM services WHERE is_active = 1").get() as { c: number };
  const avg = db.prepare("SELECT AVG(price) as a FROM services WHERE is_active = 1").get() as { a: number | null };

  const popular = db
    .prepare(
      `SELECT o.service_name as name, COUNT(*) as cnt, s.duration_minutes
       FROM orders o
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.status = 'completed' AND date(o.completed_at) = ${todayDateSql()}
       GROUP BY o.service_name
       ORDER BY cnt DESC LIMIT 1`
    )
    .get() as { name: string; cnt: number; duration_minutes: number | null } | undefined;

  res.json({
    totalServices: total.c,
    averagePrice: avg.a ?? 0,
    mostPopular: popular
      ? { name: popular.name, count: popular.cnt, durationMinutes: popular.duration_minutes ?? null }
      : null,
  });
});

app.post("/api/services", (req, res) => {
  const { name, category, duration_minutes, price, icon } = req.body;
  if (!name || price == null) {
    res.status(400).json({ error: "Tên và giá là bắt buộc" });
    return;
  }
  const result = db
    .prepare(
      `INSERT INTO services (name, category, duration_minutes, price, icon)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      name,
      category ?? "Dịch vụ cắt tóc",
      duration_minutes == null || duration_minutes === "" ? null : Number(duration_minutes),
      price,
      icon ?? "content_cut"
    );

  const row = db.prepare("SELECT * FROM services WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(row);
});

app.put("/api/services/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM services WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "Không tìm thấy dịch vụ" });
    return;
  }
  const { name, category, duration_minutes, price, icon } = req.body;
  db.prepare(
    `UPDATE services SET name = ?, category = ?, duration_minutes = ?, price = ?, icon = ?
     WHERE id = ?`
  ).run(
    name ?? (existing as ServiceRow).name,
    category ?? (existing as ServiceRow).category,
    duration_minutes !== undefined
      ? duration_minutes == null || duration_minutes === ""
        ? null
        : Number(duration_minutes)
      : (existing as ServiceRow).duration_minutes,
    price ?? (existing as ServiceRow).price,
    icon ?? (existing as ServiceRow).icon,
    id
  );
  res.json(db.prepare("SELECT * FROM services WHERE id = ?").get(id));
});

app.delete("/api/services/:id", (req, res) => {
  const id = Number(req.params.id);
  const used = db.prepare("SELECT COUNT(*) as c FROM orders WHERE service_id = ?").get(id) as { c: number };
  if (used.c > 0) {
    db.prepare("UPDATE services SET is_active = 0 WHERE id = ?").run(id);
  } else {
    db.prepare("DELETE FROM services WHERE id = ?").run(id);
  }
  res.json({ ok: true });
});

// ——— Orders ———
app.get("/api/orders", (req, res) => {
  const status = req.query.status as OrderStatus | undefined;
  const search = String(req.query.search ?? "").trim().toLowerCase();
  const todayOnly = req.query.today === "1";

  let sql = "SELECT * FROM orders WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (todayOnly) {
    sql += ` AND (date(created_at) = ${todayDateSql()} OR date(completed_at) = ${todayDateSql()})`;
  }
  sql += " ORDER BY created_at DESC";

  let rows = db.prepare(sql).all(...params) as OrderRow[];

  if (search) {
    rows = rows.filter(
      (r) =>
        r.customer_name.toLowerCase().includes(search) ||
        r.service_name.toLowerCase().includes(search) ||
        r.barber.toLowerCase().includes(search) ||
        String(r.id).includes(search)
    );
  }
  res.json(rows.map(serializeOrder));
});

app.post("/api/orders", (req, res) => {
  const { customer_name, barber, service_id, service_name, amount, status, note, items } = req.body;

  const servicesById = new Map(
    (db.prepare("SELECT * FROM services WHERE is_active = 1").all() as ServiceRow[]).map((s) => [s.id, s])
  );

  let lineItems = Array.isArray(items)
    ? buildItemsFromInput(items as OrderItemInput[], servicesById)
    : null;

  if (!lineItems && service_id) {
    lineItems = buildItemsFromInput([{ service_id, quantity: 1 }], servicesById);
  }

  let finalName = service_name;
  let finalAmount = amount;

  if (lineItems) {
    finalName = formatItemsSummary(lineItems);
    finalAmount = computeItemsTotal(lineItems);
  } else if (service_id) {
    const svc = servicesById.get(Number(service_id));
    if (!svc) {
      res.status(400).json({ error: "Dịch vụ không tồn tại" });
      return;
    }
    finalName = svc.name;
    finalAmount = finalAmount ?? svc.price;
  }

  if (!finalName || finalAmount == null) {
    res.status(400).json({ error: "Chọn ít nhất một dịch vụ" });
    return;
  }

  const primaryServiceId = lineItems?.[0]?.service_id ?? service_id ?? null;
  const itemsJson = lineItems ? JSON.stringify(lineItems) : null;

  const orderStatus: OrderStatus = status ?? "in_progress";
  const result = db
    .prepare(
      `INSERT INTO orders (customer_name, barber, service_id, service_name, amount, status, note, items_json, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      customer_name ?? "Khách vãng lai",
      barber ?? "Bất kỳ",
      primaryServiceId,
      finalName,
      finalAmount,
      orderStatus,
      note ?? null,
      itemsJson,
      orderStatus === "completed" ? new Date().toISOString() : null
    );

  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(result.lastInsertRowid) as OrderRow;
  res.status(201).json(serializeOrder(row));
});

app.patch("/api/orders/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Không tìm thấy đơn" });
    return;
  }

  const { status, customer_name, barber, amount, note, items } = req.body;
  const newStatus: OrderStatus = status ?? row.status;
  const completedAt =
    newStatus === "completed" && row.status !== "completed"
      ? new Date().toISOString()
      : newStatus === "completed"
        ? row.completed_at
        : null;

  let serviceId = row.service_id;
  let serviceName = row.service_name;
  let orderAmount = amount ?? row.amount;
  let itemsJson: string | null = row.items_json;

  if (Array.isArray(items)) {
    const servicesById = new Map(
      (db.prepare("SELECT * FROM services").all() as ServiceRow[]).map((s) => [s.id, s])
    );
    const lineItems = buildItemsFromInput(items as OrderItemInput[], servicesById);
    if (!lineItems || lineItems.length === 0) {
      res.status(400).json({ error: "Chọn ít nhất một dịch vụ" });
      return;
    }
    serviceId = lineItems[0].service_id;
    serviceName = formatItemsSummary(lineItems);
    orderAmount = computeItemsTotal(lineItems);
    itemsJson = JSON.stringify(lineItems);
  }

  db.prepare(
    `UPDATE orders SET status = ?, customer_name = ?, barber = ?, service_id = ?, service_name = ?, amount = ?, note = ?, items_json = ?, completed_at = ?
     WHERE id = ?`
  ).run(
    newStatus,
    customer_name ?? row.customer_name,
    barber ?? row.barber,
    serviceId,
    serviceName,
    orderAmount,
    note !== undefined ? note : row.note,
    itemsJson,
    completedAt,
    id
  );

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow;
  res.json(serializeOrder(updated));
});

app.delete("/api/orders/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.delete("/api/orders/held/clear", (_req, res) => {
  db.prepare("UPDATE orders SET status = 'cancelled' WHERE status = 'held'").run();
  res.json({ ok: true });
});

// ——— Dashboard ———
app.get("/api/dashboard", (req, res) => {
  const rawMode = String(req.query.mode ?? "day");
  const mode: DashboardMode =
    rawMode === "month" ? "month" : rawMode === "range" ? "range" : "day";
  const heldRevenue = (
    db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM orders WHERE status = 'held'`).get() as {
      s: number;
    }
  ).s;

  if (mode === "month") {
    const month = parseMonthParam(req.query.month);
    const prev = previousMonth(month);

    const customers = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM orders
           WHERE status = 'completed' AND strftime('%Y-%m', completed_at) = ?`
        )
        .get(month) as { c: number }
    ).c;

    const revenue = (
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as s FROM orders
           WHERE status = 'completed' AND strftime('%Y-%m', completed_at) = ?`
        )
        .get(month) as { s: number }
    ).s;

    const customersPrev = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM orders
           WHERE status = 'completed' AND strftime('%Y-%m', completed_at) = ?`
        )
        .get(prev) as { c: number }
    ).c;

    const revenuePrev = (
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as s FROM orders
           WHERE status = 'completed' AND strftime('%Y-%m', completed_at) = ?`
        )
        .get(prev) as { s: number }
    ).s;

    const completedRows = db
      .prepare(
        `SELECT * FROM orders
         WHERE status = 'completed' AND strftime('%Y-%m', completed_at) = ?`
      )
      .all(month) as OrderRow[];

    const serviceStats = aggregateServiceStats(completedRows);
    const topService = topServiceFromStats(serviceStats);

    const [y, m] = month.split("-");
    const periodLabel = `Tháng ${Number(m)} năm ${y}`;

    res.json({
      mode: "month",
      month,
      periodLabel,
      customerCount: customers,
      revenue,
      customerGrowthPct: growthPct(customers, customersPrev),
      revenueGrowthPct: growthPct(revenue, revenuePrev),
      growthCompareLabel: "so với tháng trước",
      customerLabel: "Khách trong tháng",
      revenueLabel: "Doanh thu tháng",
      sessionsSuffix: "lượt trong tháng",
      emptyMessage: "Chưa có đơn hoàn thành trong tháng này",
      topService,
      serviceStats,
      heldRevenue,
    });
    return;
  }

  if (mode === "range") {
    const { from, to } = parseDateRange(req.query.from, req.query.to);
    const prev = previousRange(from, to);

    const customers = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM orders
           WHERE status = 'completed' AND date(completed_at) >= ? AND date(completed_at) <= ?`
        )
        .get(from, to) as { c: number }
    ).c;

    const revenue = (
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as s FROM orders
           WHERE status = 'completed' AND date(completed_at) >= ? AND date(completed_at) <= ?`
        )
        .get(from, to) as { s: number }
    ).s;

    const customersPrev = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM orders
           WHERE status = 'completed' AND date(completed_at) >= ? AND date(completed_at) <= ?`
        )
        .get(prev.from, prev.to) as { c: number }
    ).c;

    const revenuePrev = (
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as s FROM orders
           WHERE status = 'completed' AND date(completed_at) >= ? AND date(completed_at) <= ?`
        )
        .get(prev.from, prev.to) as { s: number }
    ).s;

    const completedRows = db
      .prepare(
        `SELECT * FROM orders
         WHERE status = 'completed' AND date(completed_at) >= ? AND date(completed_at) <= ?`
      )
      .all(from, to) as OrderRow[];

    const serviceStats = aggregateServiceStats(completedRows);
    const topService = topServiceFromStats(serviceStats);

    res.json({
      mode: "range",
      from,
      to,
      periodLabel: formatDateRangeLabel(from, to),
      customerCount: customers,
      revenue,
      customerGrowthPct: growthPct(customers, customersPrev),
      revenueGrowthPct: growthPct(revenue, revenuePrev),
      growthCompareLabel: "so với kỳ trước cùng độ dài",
      customerLabel: "Khách trong kỳ",
      revenueLabel: "Doanh thu kỳ",
      sessionsSuffix: "lượt trong kỳ",
      emptyMessage: "Chưa có đơn hoàn thành trong khoảng ngày này",
      topService,
      serviceStats,
      heldRevenue,
    });
    return;
  }

  const date = parseDateParam(req.query.date);
  const prev = previousDay(date);
  const isToday = date === localDateString();

  const customers = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM orders
         WHERE status = 'completed' AND date(completed_at) = ?`
      )
      .get(date) as { c: number }
  ).c;

  const revenue = (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as s FROM orders
         WHERE status = 'completed' AND date(completed_at) = ?`
      )
      .get(date) as { s: number }
  ).s;

  const customersPrev = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM orders
         WHERE status = 'completed' AND date(completed_at) = ?`
      )
      .get(prev) as { c: number }
  ).c;

  const revenuePrev = (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as s FROM orders
         WHERE status = 'completed' AND date(completed_at) = ?`
      )
      .get(prev) as { s: number }
  ).s;

  const completedRows = db
    .prepare(`SELECT * FROM orders WHERE status = 'completed' AND date(completed_at) = ?`)
    .all(date) as OrderRow[];

  const serviceStats = aggregateServiceStats(completedRows);
  const topService = topServiceFromStats(serviceStats);

  const periodLabel = new Date(`${date}T12:00:00`).toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  res.json({
    mode: "day",
    date,
    periodLabel,
    isToday,
    customerCount: customers,
    revenue,
    customerGrowthPct: growthPct(customers, customersPrev),
    revenueGrowthPct: growthPct(revenue, revenuePrev),
    growthCompareLabel: "so với ngày trước",
    customerLabel: isToday ? "Khách hôm nay" : "Khách trong ngày",
    revenueLabel: isToday ? "Doanh thu hôm nay" : "Doanh thu ngày",
    sessionsSuffix: isToday ? "lượt hôm nay" : "lượt trong ngày",
    emptyMessage: "Chưa có đơn hoàn thành trong ngày này",
    topService,
    serviceStats,
    heldRevenue,
  });
});

// Production: serve Vite build
const distPath = path.join(appRoot, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) next();
    });
  });
}

app.listen(PORT, "127.0.0.1", () => {
  const appUrl = `http://127.0.0.1:${PORT}`;
  console.log(`BLaoBarber: ${appUrl}`);
  console.log(`Cơ sở dữ liệu: ${dbPath}`);
  if (fs.existsSync(distPath) && process.env.BLAO_AUTO_OPEN === "1") {
    setTimeout(openAppInBrowser, 400);
  }
});
