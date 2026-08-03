import type { StaffRoleRow } from "./database.js";

export const PROXY_OWNER_ROLE_LABEL = "Ông chủ giả lập";

export function normalizeRoleName(name: string) {
  return String(name ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Nhan dien role chu gia lap: uu tien co is_proxy_owner, fallback theo ten */
export function isProxyRole(role: StaffRoleRow | undefined | null) {
  if (!role) return false;
  if (Number(role.is_proxy_owner) === 1) return true;
  return normalizeRoleName(role.name) === normalizeRoleName(PROXY_OWNER_ROLE_LABEL);
}
