import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";

export type ServiceRow = {
  id: number;
  name: string;
  category: string;
  duration_minutes: number | null;
  price: number;
  /** % tien cua dich vu ma chu gia lap tra lai quan */
  shop_percent: number;
  icon: string;
  is_active: number;
  created_at: string;
};

export type OrderStatus = "in_progress" | "held" | "completed" | "cancelled";

export type OrderRow = {
  id: number;
  customer_name: string;
  barber: string;
  service_id: number | null;
  service_name: string;
  amount: number;
  discount_percent?: number;
  status: OrderStatus;
  note: string | null;
  items_json: string | null;
  created_at: string;
  completed_at: string | null;
};

export type StaffRoleRow = {
  id: number;
  name: string;
  sort_order: number;
  is_active: number;
  /** 1 = Ong chu gia lap — tinh phan con lai, khong dung diem */
  is_proxy_owner: number;
};

export type EmployeeRow = {
  id: number;
  name: string;
  role_id: number;
  salary_coefficient: number;
  is_active: number;
  created_at: string;
};

export type ServiceRolePointRow = {
  service_id: number;
  role_id: number;
  points: number;
};

export type DepreciationRow = {
  id: number;
  name: string;
  amount: number;
  description: string | null;
  expense_date: string; // YYYY-MM-DD
  created_at: string;
  is_active: number;
};

export type ProfitDailyRow = {
  id: number;
  profit_date: string; // YYYY-MM-DD
  revenue: number;
  payroll: number;
  depreciation: number;
  profit: number;
  created_at: string;
};

const dbDir =
  process.env.BLAO_DB_DIR ??
  path.join(process.env.APPDATA ?? os.homedir(), "BLaoBarber");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const DEFAULT_POINT_RATE_VND = 1000;

export const dbPath = path.join(dbDir, "data.db");
export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Dịch vụ cắt tóc',
    duration_minutes INTEGER,
    price REAL NOT NULL,
    icon TEXT NOT NULL DEFAULT 'content_cut',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL DEFAULT 'Khách vãng lai',
    barber TEXT NOT NULL DEFAULT 'Bất kỳ',
    service_id INTEGER,
    service_name TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('in_progress', 'held', 'completed', 'cancelled')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    completed_at TEXT,
    FOREIGN KEY (service_id) REFERENCES services(id)
  );
`);

function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) as c FROM services").get() as { c: number };
  if (count.c > 0) return;

  const insert = db.prepare(`
    INSERT INTO services (name, category, duration_minutes, price, icon)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seeds = [
    ["Cắt tóc Executive", "Dịch vụ cắt tóc", 45, 150000, "content_cut"],
    ["Cạo râu khăn nóng", "Thư giãn", 30, 120000, "face"],
    ["Tạo kiểu râu", "Dịch vụ cắt tóc", 25, 80000, "brush"],
    ["Combo B'Lao Signature", "Dịch vụ lẻ", 90, 350000, "star"],
  ] as const;

  for (const row of seeds) {
    insert.run(...row);
  }
}

function migrateDurationOptional() {
  const cols = db.prepare("PRAGMA table_info(services)").all() as {
    name: string;
    notnull: number;
  }[];
  const col = cols.find((c) => c.name === "duration_minutes");
  if (!col || col.notnull === 0) return;

  db.exec(`
    CREATE TABLE services_migrate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Dịch vụ cắt tóc',
      duration_minutes INTEGER,
      price REAL NOT NULL,
      icon TEXT NOT NULL DEFAULT 'content_cut',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    INSERT INTO services_migrate (id, name, category, duration_minutes, price, icon, is_active, created_at)
    SELECT id, name, category, duration_minutes, price, icon, is_active, created_at FROM services;
    DROP TABLE services;
    ALTER TABLE services_migrate RENAME TO services;
  `);
}

function migrateOrderItemsJson() {
  const cols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  if (cols.some((c) => c.name === "items_json")) return;
  db.exec("ALTER TABLE orders ADD COLUMN items_json TEXT");
}

function migrateOrderDiscountPercent() {
  const cols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  if (cols.some((c) => c.name === "discount_percent")) return;
  db.exec("ALTER TABLE orders ADD COLUMN discount_percent REAL NOT NULL DEFAULT 0");
}

function migratePayrollTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      salary_coefficient REAL NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (role_id) REFERENCES staff_roles(id)
    );

    CREATE TABLE IF NOT EXISTS service_role_points (
      service_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      points REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (service_id, role_id),
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES staff_roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const roleCount = db.prepare("SELECT COUNT(*) as c FROM staff_roles").get() as { c: number };
  if (roleCount.c === 0) {
    const insertRole = db.prepare(
      "INSERT INTO staff_roles (name, sort_order) VALUES (?, ?)"
    );
    const roles = [
      ["Thợ cắt", 1],
      ["Thợ gội", 2],
      ["Phụ tá", 3],
    ] as const;
    for (const [name, order] of roles) {
      insertRole.run(name, order);
    }
  }

  const empCount = db.prepare("SELECT COUNT(*) as c FROM employees").get() as { c: number };
  if (empCount.c === 0) {
    const cutRole = db.prepare("SELECT id FROM staff_roles WHERE name = ?").get("Thợ cắt") as
      | { id: number }
      | undefined;
    const roleId = cutRole?.id ?? 1;
    const insertEmp = db.prepare(
      `INSERT INTO employees (name, role_id, salary_coefficient) VALUES (?, ?, ?)`
    );
    insertEmp.run("Chủ tiệm 1", roleId, 3);
    insertEmp.run("Chủ tiệm 2", roleId, 6);
  }

  const setting = db.prepare("SELECT 1 FROM settings WHERE key = ?").get("point_rate_vnd");
  if (!setting) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
      "point_rate_vnd",
      "1000"
    );
  }
}

function migrateDepreciationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS depreciations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      expense_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_depreciations_date ON depreciations(expense_date);
  `);
}

function migrateDepreciationsIsActive() {
  const cols = db.prepare("PRAGMA table_info(depreciations)").all() as { name: string }[];
  if (cols.some((c) => c.name === "is_active")) return;
  db.exec("ALTER TABLE depreciations ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
}

function migrateProfitDailyTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profit_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profit_date TEXT NOT NULL UNIQUE,
      revenue REAL NOT NULL DEFAULT 0,
      payroll REAL NOT NULL DEFAULT 0,
      depreciation REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_profit_daily_date ON profit_daily(profit_date);
  `);
}

function migrateServiceShopPercent() {
  const cols = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  if (cols.some((c) => c.name === "shop_percent")) return;
  db.exec("ALTER TABLE services ADD COLUMN shop_percent REAL NOT NULL DEFAULT 0");
}

function migrateStaffRoleProxyOwner() {
  const cols = db.prepare("PRAGMA table_info(staff_roles)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "is_proxy_owner")) {
    db.exec("ALTER TABLE staff_roles ADD COLUMN is_proxy_owner INTEGER NOT NULL DEFAULT 0");
  }

  // Danh dau moi role ten "Ông chủ giả lập" (moi lan khoi dong — an toan)
  const allRoles = db.prepare("SELECT id, name, is_proxy_owner FROM staff_roles").all() as {
    id: number;
    name: string;
    is_proxy_owner: number;
  }[];
  for (const r of allRoles) {
    const normalized = String(r.name ?? "")
      .normalize("NFC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (normalized === "ông chủ giả lập" && Number(r.is_proxy_owner) !== 1) {
      db.prepare("UPDATE staff_roles SET is_proxy_owner = 1, is_active = 1 WHERE id = ?").run(r.id);
    }
  }

  const existing = db
    .prepare("SELECT id FROM staff_roles WHERE is_proxy_owner = 1 LIMIT 1")
    .get() as { id: number } | undefined;
  if (existing) return;

  const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) as m FROM staff_roles").get() as {
    m: number;
  };
  db.prepare("INSERT INTO staff_roles (name, sort_order, is_proxy_owner) VALUES (?, ?, 1)").run(
    "Ông chủ giả lập",
    maxOrder.m + 1
  );
}

migrateDurationOptional();
migrateOrderItemsJson();
migrateOrderDiscountPercent();
migratePayrollTables();
migrateDepreciationsTable();
migrateDepreciationsIsActive();
migrateProfitDailyTable();
migrateServiceShopPercent();
migrateStaffRoleProxyOwner();

/** Một lần: khôi phục loại thợ bị ẩn nhầm (bản cũ soft-delete) */
function migrateReactivateHiddenStaffRolesOnce() {
  const done = db.prepare("SELECT 1 FROM settings WHERE key = ?").get("staff_roles_reactivate_v1");
  if (done) return;
  db.prepare("UPDATE staff_roles SET is_active = 1 WHERE is_active = 0").run();
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("staff_roles_reactivate_v1", "1");
}

migrateReactivateHiddenStaffRolesOnce();
seedIfEmpty();

export function getSetting(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function getPointRateVnd() {
  const raw = getSetting("point_rate_vnd");
  const n = raw ? Number(raw) : DEFAULT_POINT_RATE_VND;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_POINT_RATE_VND;
}

export function todayDateSql() {
  return "date('now', 'localtime')";
}
