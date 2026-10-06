/**
 * The modules a staff member can be given access to. Each module covers the routes listed, which is
 * what the sidebar and the server-side guards both key off. Adding a module here needs no migration.
 *
 * This file is shared by server and client components — it must stay free of server-only imports.
 */
export const MODULES = {
  dashboard: { label: "Dashboard", routes: ["/dashboard"] },
  members: { label: "Members", routes: ["/members", "/departments"] },
  akwaaba: { label: "Akwaaba", routes: ["/akwaaba"] },
  sob: { label: "SOB", routes: ["/sob"] },
  tithes: { label: "Tithes Tracker", routes: ["/tithes"] },
  finances: { label: "Finances", routes: ["/finances"] },
  analytics: { label: "Analytics & Visitors", routes: ["/analytics", "/giving-analytics", "/growth", "/visitor-conversion"] },
  care: { label: "Member Care & Welfare", routes: ["/welfare", "/welfare-dues"] },
  messaging: { label: "Messages & Announcements", routes: ["/message-center", "/announcements"] },
  staffs: { label: "Staffs", routes: ["/staffs"] },
  settings: { label: "Settings", routes: ["/settings"] },
} as const;

export type ModuleKey = keyof typeof MODULES;
export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

/** Print routes are gated by the module whose data they expose. */
const PRINT_ROUTES: Record<string, ModuleKey> = {
  "/print/tithes": "tithes",
  "/print/akwaaba": "akwaaba",
  "/print/receipt": "finances",
  "/print/report": "finances",
};

/** The module a path belongs to, or null when the path is not gated (e.g. "/" or "/login"). */
export function moduleForPath(pathname: string): ModuleKey | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const [key, mod] of Object.entries(MODULES) as [ModuleKey, (typeof MODULES)[ModuleKey]][]) {
    if (mod.routes.some((r) => path === r || path.startsWith(`${r}/`))) return key;
  }
  for (const [prefix, key] of Object.entries(PRINT_ROUTES)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return key;
  }
  return null;
}

/** Superadmins keep everything; everyone else has exactly what was assigned to them. */
export const isSuperAdmin = (role: string) => role === "admin";

/** True when a module list (the signed-in user's) covers this module. */
export function hasModule(assigned: readonly string[] | "all", module: ModuleKey): boolean {
  return assigned === "all" || assigned.includes(module);
}
