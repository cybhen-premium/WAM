import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
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

/** The church the signed-in user works in, or null if they haven't set one up. */
export const getChurchForUser = cache(async (userId: string) => {
  try {
    const [row] = await retry(
      () =>
        db
          .select({
            church: schema.church,
            role: schema.staff.role,
            staffId: schema.staff.id,
            departmentId: schema.staff.departmentId,
          })
          .from(schema.staff)
          .innerJoin(schema.church, eq(schema.staff.churchId, schema.church.id))
          .where(and(eq(schema.staff.userId, userId), eq(schema.staff.status, "active")))
          .limit(1),
      undefined,
      4,
    );
    return row ?? null;
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
  return { user, church: row.church, role: row.role, staffId: row.staffId, departmentId: row.departmentId };
}
