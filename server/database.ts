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
  status: OrderStatus;
  note: string | null;
  items_json: string | null;
  created_at: string;
  completed_at: string | null;
};

const dbDir =
  process.env.BLAO_DB_DIR ??
  path.join(process.env.APPDATA ?? os.homedir(), "BLaoBarber");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

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

migrateDurationOptional();
migrateOrderItemsJson();
seedIfEmpty();

export function todayDateSql() {
  return "date('now', 'localtime')";
}
