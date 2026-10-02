import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

/**
 * Neon occasionally drops a pooled connection mid-query. One quick retry keeps a blip from being read as
 * "signed out" — otherwise a single failed session lookup logs the person out for no reason.
 * `retryWhen` lets a caller also treat a "too good to be true" result (e.g. a missing session) as worth
 * one more try.
 */
async function retry<T>(run: () => Promise<T>, retryWhen?: (value: T) => boolean): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const value = await run();
      if (attempt < 2 && retryWhen?.(value)) {
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }
      return value;
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

export const getUser = cache(async () => {
  const requestHeaders = await headers();
  const session = await retry(() => auth.api.getSession({ headers: requestHeaders }), (s) => !s);
  return session?.user ?? null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** The church the signed-in user works in, or null if they haven't set one up. */
export const getChurchForUser = cache(async (userId: string) => {
  const [row] = await retry(() =>
    db
      .select({ church: schema.church, role: schema.staff.role, staffId: schema.staff.id })
      .from(schema.staff)
      .innerJoin(schema.church, eq(schema.staff.churchId, schema.church.id))
      .where(and(eq(schema.staff.userId, userId), eq(schema.staff.status, "active")))
      .limit(1),
  );
  return row ?? null;
});

/** Use in every app page and server action: guarantees a user and their church. */
export async function requireChurch() {
  const user = await requireUser();
  const row = await getChurchForUser(user.id);
  if (!row) {
    const [staffRow] = await retry(() => 
      db.select({ status: schema.staff.status }).from(schema.staff).where(eq(schema.staff.userId, user.id)).limit(1)
    );
    if (staffRow) {
      redirect(`/login?status=${staffRow.status}`);
    } else {
      redirect("/login?status=deleted");
    }
  }
  return { user, church: row.church, role: row.role };
}
