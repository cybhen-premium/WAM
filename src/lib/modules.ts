/**
 * The modules a staff member can be given access to. Each module covers the routes listed, which is
 * what the sidebar and the server-side guards both key off. Adding a module here needs no migration.
 *
 * This file is shared by server and client components — it must stay free of server-only imports.
 */
export const MODULES = {
  dashboard: { label: "Dashboard", routes: ["/dashboard"] },
  members: { label: "Members", routes: ["/members"] },
  departments: { label: "Departments", routes: ["/departments"] },
  department_portal: { label: "Department Portal (Admin)", routes: ["/department-portal"] },
  akwaaba: { label: "Akwaaba Intake", routes: ["/akwaaba"] },
  visitors: { label: "Visitors", routes: ["/visitor-conversion"] },
  sob: { label: "School of Baptism", routes: ["/sob"] },
  tithes: { label: "Tithes Tracker", routes: ["/tithes"] },
  finances: { label: "Finance & Accounts", routes: ["/finances"] },
  welfare_dues: { label: "Welfare Dues", routes: ["/welfare-dues"] },
  giving_analytics: { label: "Giving Analytics", routes: ["/giving-analytics"] },
  growth: { label: "Growth Trends", routes: ["/growth"] },
  welfare: { label: "Member Care", routes: ["/welfare"] },
  announcements: { label: "Announcements", routes: ["/announcements"] },
  messaging: { label: "SMS Messages", routes: ["/message-center"] },
  analytics: { label: "Analytics & Activity", routes: ["/analytics"] },
  staffs: { label: "Staff Management", routes: ["/staffs"] },
  settings: { label: "System Settings", routes: ["/settings"] },
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
export function hasModule(assigned: readonly string[] | "all", module: ModuleKey | string): boolean {
  if (assigned === "all") return true;
  if (assigned.includes(module)) return true;
  // Legacy aliases
  if ((module === "welfare" || module === "welfare_dues") && assigned.includes("care")) return true;
  if (module === "care" && (assigned.includes("welfare") || assigned.includes("welfare_dues"))) return true;
  if (module === "announcements" && assigned.includes("messaging")) return true;
  if (
    (module === "visitors" || module === "giving_analytics" || module === "growth") &&
    assigned.includes("analytics")
  ) {
    return true;
  }
  return false;
}
