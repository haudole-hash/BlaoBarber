import type { Express } from "express";
import { db, getSetting } from "./database.js";

export const DEFAULT_SERVICE_CATEGORIES = ["Dịch vụ cắt tóc", "Thư giãn", "Dịch vụ lẻ"] as const;

const EXTRA_KEY = "service_category_extra";
const HIDDEN_KEY = "service_category_hidden";

function readJsonArray(key: string): string[] {
  const raw = getSetting(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, values: string[]) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, JSON.stringify(values));
}

function countServicesByCategory() {
  const rows = db
    .prepare("SELECT category FROM services WHERE is_active = 1")
    .all() as { category: string }[];
  const map = new Map<string, number>();
  for (const row of rows) {
    const c = row.category?.trim();
    if (!c) continue;
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  return map;
}

/** Danh sach loai cho form Dich vu (co the chua co dich vu) */
export function listServiceCategoriesForPicker() {
  const hidden = new Set(readJsonArray(HIDDEN_KEY));
  const extra = readJsonArray(EXTRA_KEY);
  const countByCat = countServicesByCategory();
  const set = new Set<string>();

  for (const c of DEFAULT_SERVICE_CATEGORIES) {
    if (!hidden.has(c)) set.add(c);
  }
  for (const c of extra) {
    if (!hidden.has(c)) set.add(c);
  }
  for (const c of countByCat.keys()) {
    if (!hidden.has(c)) set.add(c);
  }

  return [...set]
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((name) => ({
      name,
      serviceCount: countByCat.get(name) ?? 0,
    }));
}

export function registerServiceCategoryRoutes(app: Express) {
  app.get("/api/service-categories", (_req, res) => {
    res.json({ categories: listServiceCategoriesForPicker() });
  });

  app.post("/api/service-categories", (req, res) => {
    const name = String(req.body.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Nhập tên loại dịch vụ" });
      return;
    }

    const hidden = readJsonArray(HIDDEN_KEY).filter((c) => c !== name);
    writeJsonArray(HIDDEN_KEY, hidden);

    const extra = readJsonArray(EXTRA_KEY);
    const isDefault = (DEFAULT_SERVICE_CATEGORIES as readonly string[]).includes(name);
    if (!isDefault && !extra.includes(name)) {
      extra.push(name);
      writeJsonArray(EXTRA_KEY, extra);
    }

    res.status(201).json({ ok: true, name });
  });

  app.delete("/api/service-categories/:name", (req, res) => {
    const name = decodeURIComponent(String(req.params.name ?? "")).trim();
    if (!name) {
      res.status(400).json({ error: "Tên loại không hợp lệ" });
      return;
    }

    const used = db
      .prepare("SELECT COUNT(*) as c FROM services WHERE is_active = 1 AND category = ?")
      .get(name) as { c: number };
    if (used.c > 0) {
      res.status(400).json({
        error: `Không xóa được — còn ${used.c} dịch vụ thuộc loại «${name}».`,
      });
      return;
    }

    const hidden = readJsonArray(HIDDEN_KEY);
    if (!hidden.includes(name)) hidden.push(name);
    writeJsonArray(HIDDEN_KEY, hidden);

    const extra = readJsonArray(EXTRA_KEY).filter((c) => c !== name);
    writeJsonArray(EXTRA_KEY, extra);

    res.json({ ok: true });
  });
}
