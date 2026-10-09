import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

/**
 * Neon occasionally drops a pooled connection mid-query or takes a moment to wake from compute auto-suspend.
 * An exponential backoff retry keeps a blip from being read as "signed out" — otherwise a single failed
 * session lookup logs the person out for no reason.
 * `retryWhen` lets a caller also treat an empty result (e.g. a missing session due to replication lag) as
 * worth one more try.
 */
async function retry<T>(
  run: () => Promise<T>,
  retryWhen?: (value: T) => boolean,
  maxAttempts = 4,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await run();
      if (attempt < maxAttempts && retryWhen?.(value)) {
        await new Promise((r) => setTimeout(r, attempt * 200));
        continue;
      }
      return value;
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts) break;
      // Exponential backoff: 200ms, 400ms, 800ms
      const delay = Math.min(200 * Math.pow(2, attempt - 1), 1500);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export const getUser = cache(async () => {
  try {
    const requestHeaders = await headers();
    const session = await retry(
      () => auth.api.getSession({ headers: requestHeaders }),
      (s) => !s,
      4,
    );
    return session?.user ?? null;
  } catch (err) {
    console.error("[Session] Error fetching user session from database:", err);
    return null;
  }
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login?reason=expired");
  return user;
}

export type UserBranchInfo = {
  church: typeof schema.church.$inferSelect;
  role: string;
  staffId: string;
  departmentId: string | null;
  status: string;
};

function prioritizeSalvation<T extends { church: { name: string } }>(branches: T[]): T[] {
  return [...branches].sort((a, b) => {
    const aSalvation = /salvation/i.test(a.church.name);
    const bSalvation = /salvation/i.test(b.church.name);
    if (aSalvation && !bSalvation) return -1;
    if (!aSalvation && bSalvation) return 1;
    return a.church.name.localeCompare(b.church.name);
  });
}

/** All active branches the signed-in user is assigned to. */
export const getUserBranches = cache(async (userId: string): Promise<UserBranchInfo[]> => {
  try {
    const rows = await retry(
      () =>
        db
          .select({
            church: schema.church,
            role: schema.staff.role,
            staffId: schema.staff.id,
            departmentId: schema.staff.departmentId,
            status: schema.staff.status,
          })
          .from(schema.staff)
          .innerJoin(schema.church, eq(schema.staff.churchId, schema.church.id))
          .where(and(eq(schema.staff.userId, userId), eq(schema.staff.status, "active"))),
      undefined,
      4,
    );

    // If no staff row was found, check if the user is a church owner (superadmin)
    if (rows.length === 0) {
      const ownedChurches = await retry(
        () =>
          db
            .select()
            .from(schema.church)
            .where(eq(schema.church.ownerId, userId)),
        undefined,
        4,
      );
      if (ownedChurches.length > 0) {
        return prioritizeSalvation(
          ownedChurches.map((c) => ({
            church: c,
            role: "admin",
            staffId: "",
            departmentId: null,
            status: "active",
          }))
        );
      }
    }

    return prioritizeSalvation(rows);
  } catch (err) {
    console.error("[Session] Error fetching user branches:", err);
    return [];
  }
});

/** The church the signed-in user is currently working with, or null if they haven't set one up. */
export const getChurchForUser = cache(async (userId: string) => {
  try {
    const branches = await getUserBranches(userId);
    if (!branches || branches.length === 0) return null;

    let activeBranchId: string | undefined;
    try {
      const cookieStore = await cookies();
      activeBranchId = cookieStore.get("active_branch_id")?.value;
    } catch {
      // In contexts without cookies
    }

    if (activeBranchId) {
      const matched = branches.find((b) => b.church.id === activeBranchId);
      if (matched) return matched;
    }

    // Default to first active branch
    return branches[0];
  } catch (err) {
    console.error("[Session] Error fetching church for user:", err);
    return null;
  }
});

/** Use in every app page and server action: guarantees a user and their church. */
export async function requireChurch() {
  const user = await requireUser();
  const row = await getChurchForUser(user.id);
  if (!row) {
    try {
      const [staffRow] = await retry(
        () =>
          db.select({ status: schema.staff.status }).from(schema.staff).where(eq(schema.staff.userId, user.id)).limit(1),
        undefined,
        4,
      );
      if (staffRow) {
        redirect(`/login?status=${staffRow.status}`);
      } else {
        redirect("/login?status=deleted");
      }
    } catch {
      redirect("/login?status=deleted");
    }
  }

  const allBranches = await getUserBranches(user.id);

  return {
    user,
    church: row.church,
    role: row.role,
    staffId: row.staffId,
    departmentId: row.departmentId,
    availableBranches: allBranches.map((b) => ({
      id: b.church.id,
      name: b.church.name,
      role: b.role,
    })),
  };
}
