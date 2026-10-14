import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getChurchForUser, getUser } from "@/lib/session";
import { isSuperAdmin, moduleForPath, MODULES, MODULE_KEYS, type ModuleKey } from "@/lib/modules";

export { MODULES, MODULE_KEYS, moduleForPath, isSuperAdmin, hasModule, type ModuleKey } from "@/lib/modules";

/**
 * Returns true if this church branch has centralized administration
 * (settings and staff management are handled exclusively by the super admin at headquarters).
 */
export function isBranchWithDisabledAdmin(churchName?: string | null): boolean {
  if (!churchName) return false;
  return churchName.toLowerCase().includes("holy spirit");
}

/** "all" = superadmin (every module). Otherwise the set of assigned module keys. */
export type Permissions = "all" | Set<ModuleKey>;

export const getMyPermissions = cache(async (): Promise<Permissions> => {
  const user = await getUser();
  if (!user) return new Set();
  const row = await getChurchForUser(user.id);
  if (!row) return new Set();

  const isHolySpirit = isBranchWithDisabledAdmin(row.church.name);

  if (isSuperAdmin(row.role)) {
    if (isHolySpirit) {
      // In Holy Spirit Citadel, exclude staffs and settings even for superadmin
      return new Set(MODULE_KEYS.filter((k) => k !== "staffs" && k !== "settings"));
    }
    return "all";
  }

  // Load only the modules explicitly assigned to this staff member.
  const rows = await db
    .select({ module: schema.staffModule.module })
    .from(schema.staffModule)
    .where(eq(schema.staffModule.staffId, row.staffId));
  const assigned = rows.map((r) => r.module).filter((m): m is ModuleKey => m in MODULES);

  // If this staff member is assigned to a department, grant department_portal
  // on top of their other assigned modules (not instead of them).
  if (row.departmentId && !assigned.includes("department_portal")) {
    assigned.push("department_portal");
  }

  if (isHolySpirit) {
    return new Set(assigned.filter((k) => k !== "staffs" && k !== "settings"));
  }

  return new Set(assigned);
});

/** True when the signed-in user may use this module. */
export async function can(module: ModuleKey | string): Promise<boolean> {
  const user = await getUser();
  if (user) {
    const row = await getChurchForUser(user.id);
    if (row && isBranchWithDisabledAdmin(row.church.name) && (module === "staffs" || module === "settings")) {
      return false;
    }
  }
  const perms = await getMyPermissions();
  if (perms === "all") return true;
  if (perms.has(module as ModuleKey)) return true;
  // Legacy alias fallbacks
  if ((module === "welfare" || module === "welfare_dues") && perms.has("care" as any)) return true;
  if (module === "care" && (perms.has("welfare" as any) || perms.has("welfare_dues" as any))) return true;
  if (module === "departments" && perms.has("members")) return true;
  if (module === "announcements" && perms.has("messaging")) return true;
  if (
    (module === "visitors" || module === "giving_analytics" || module === "growth") &&
    perms.has("analytics")
  ) {
    return true;
  }
  return false;
}

/** Server guard for a page or a server action — 404s when the user has no access. */
export async function requireModule(module: ModuleKey): Promise<void> {
  if (!(await can(module))) notFound();
}

/** Server guard by path, for shared surfaces like the print routes. */
export async function requirePath(pathname: string): Promise<void> {
  const gate = moduleForPath(pathname);
  if (gate) await requireModule(gate);
}

/**
 * Where to send a signed-in user: the dashboard when they may open it, otherwise the first module they
 * were given — so nobody is dropped on a page they cannot access.
 */
export async function landingHref(): Promise<string> {
  const user = await getUser();
  let isHolySpirit = false;
  if (user) {
    const row = await getChurchForUser(user.id);
    if (row) {
      isHolySpirit = isBranchWithDisabledAdmin(row.church.name);
    }
  }
  if (await can("dashboard")) return "/dashboard";
  const perms = await getMyPermissions();
  if (perms === "all") return "/dashboard";
  const first = MODULE_KEYS.find((k) => {
    if (isHolySpirit && (k === "staffs" || k === "settings")) return false;
    return perms.has(k);
  });
  return first ? MODULES[first].routes[0] : "/dashboard";
}


