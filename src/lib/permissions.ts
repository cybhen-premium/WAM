import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getChurchForUser, getUser } from "@/lib/session";
import { isSuperAdmin, moduleForPath, MODULES, MODULE_KEYS, type ModuleKey } from "@/lib/modules";

export { MODULES, MODULE_KEYS, moduleForPath, isSuperAdmin, hasModule, type ModuleKey } from "@/lib/modules";

/** "all" = superadmin (every module). Otherwise the set of assigned module keys. */
export type Permissions = "all" | Set<ModuleKey>;

export const getMyPermissions = cache(async (): Promise<Permissions> => {
  const user = await getUser();
  if (!user) return new Set();
  const row = await getChurchForUser(user.id);
  if (!row) return new Set();
  if (row.departmentId) {
    return new Set<ModuleKey>(["department_portal"]);
  }
  if (isSuperAdmin(row.role)) return "all";

  const rows = await db
    .select({ module: schema.staffModule.module })
    .from(schema.staffModule)
    .where(eq(schema.staffModule.staffId, row.staffId));
  return new Set(rows.map((r) => r.module).filter((m): m is ModuleKey => m in MODULES));
});

/** True when the signed-in user may use this module. */
export async function can(module: ModuleKey): Promise<boolean> {
  const perms = await getMyPermissions();
  return perms === "all" || perms.has(module);
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
  if (user) {
    const row = await getChurchForUser(user.id);
    if (row?.departmentId) return "/department-portal";
  }
  if (await can("dashboard")) return "/dashboard";
  const perms = await getMyPermissions();
  if (perms === "all") return "/dashboard";
  const first = MODULE_KEYS.find((k) => perms.has(k));
  return first ? MODULES[first].routes[0] : "/dashboard";
}

