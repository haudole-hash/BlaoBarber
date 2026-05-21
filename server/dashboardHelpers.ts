export type DashboardMode = "day" | "month" | "range";

export function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localMonthString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseDateParam(value: unknown): string {
  const s = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return localDateString();
}

export function parseMonthParam(value: unknown): string {
  const s = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return localMonthString();
}

export function previousDay(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localDateString(dt);
}

export function previousMonth(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const dt = new Date(y, m - 2, 1);
  return localMonthString(dt);
}

export function growthPct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function parseDateRange(from: unknown, to: unknown) {
  let fromDate = parseDateParam(from);
  let toDate = parseDateParam(to);
  if (fromDate > toDate) {
    const tmp = fromDate;
    fromDate = toDate;
    toDate = tmp;
  }
  return { from: fromDate, to: toDate };
}

export function daysInRange(from: string, to: string) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

/** Kỳ trước cùng độ dài (ngay trước ngày bắt đầu) */
export function previousRange(from: string, to: string) {
  const len = daysInRange(from, to);
  const [y, m, d] = from.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (len - 1));
  return { from: localDateString(start), to: localDateString(end) };
}

export function formatDateRangeLabel(from: string, to: string) {
  const fmt = (dateStr: string) =>
    new Date(`${dateStr}T12:00:00`).toLocaleDateString("vi-VN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  if (from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

export function startOfMonthString(d = new Date()) {
  return localDateString(new Date(d.getFullYear(), d.getMonth(), 1));
}
