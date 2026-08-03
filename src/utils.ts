import type { Service } from "./types";

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

/** Ngày đầu tháng hiện tại (YYYY-MM-DD) */
export function startOfMonthString(d = new Date()) {
  return localDateString(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** N ngày trước tính đến hôm nay */
export function rangeLastDays(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: localDateString(from), to: localDateString(to) };
}

/** Hiển thị YYYY-MM → "Tháng 5 năm 2026" */
export function formatMonthLabel(monthStr: string) {
  const [y, m] = monthStr.split("-");
  return `Tháng ${Number(m)} năm ${y}`;
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDuration(minutes: number | null | undefined) {
  if (minutes == null || minutes <= 0) return "—";
  return `${minutes} phút`;
}

export const DURATION_PRESETS = [15, 30, 45, 60, 90] as const;

export function minutesAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} giờ trước`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Tiêu đề tab trang chính — cùng font/cỡ với trang Tổng quan */
export const PAGE_TITLE_CLASS = "font-headline-md text-headline-md font-semibold text-primary";

export const BARBERS = ["Bất kỳ", "Chủ tiệm 1", "Chủ tiệm 2"];
export const CATEGORIES = ["Dịch vụ cắt tóc", "Thư giãn", "Dịch vụ lẻ"] as const;

/** Gop loai mac dinh + loai dang co trong danh muc dich vu */
export function collectServiceCategories(services: { category: string }[]) {
  const set = new Set<string>([...CATEGORIES]);
  for (const s of services) {
    const c = s.category?.trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "vi"));
}

export function groupServicesByCategory(services: Service[]) {
  const categories = collectServiceCategories(services);
  const map = new Map<string, Service[]>();
  for (const cat of categories) map.set(cat, []);
  for (const s of services) {
    const list = map.get(s.category) ?? [];
    list.push(s);
    map.set(s.category, list);
  }
  for (const [cat, list] of map) {
    list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    map.set(cat, list);
  }
  return { categories, byCategory: map };
}

/** Chi hien cot loai co it nhat mot dich vu — dung tab Don hang */
export function groupServicesByCategoryForOrders(services: Service[]) {
  const map = new Map<string, Service[]>();
  for (const s of services) {
    const cat = s.category?.trim();
    if (!cat) continue;
    const list = map.get(cat) ?? [];
    list.push(s);
    map.set(cat, list);
  }
  for (const [cat, list] of map) {
    list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    map.set(cat, list);
  }
  const categories = [...map.keys()]
    .filter((cat) => (map.get(cat)?.length ?? 0) > 0)
    .sort((a, b) => a.localeCompare(b, "vi"));
  return { categories, byCategory: map };
}

export const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDtQDa3KneHPRwimLEFRwaswpMYoqKVrEZXr7iJt8fVqDfh-o9ye8WtjkI1uMRx6Y6Lv7HMmfcdP8-SfQxFQSfRqfftRq3pAlpn0dqoLLpYKZyD2aYTR834jskFzZ-f_eEpi66YHEioWxduc7m14qmt_2_PO_c9TV76qe-4RdG11ICa9P794nF_A0HP7oHabrCwmCPBr-Pt_pswt6QdQIgTdu_6LAwELq2I5c3zB0LIOI5wCqbs_X6z1Al9tAJuafeftehpajRcZ9k-";
