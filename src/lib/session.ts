import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

export const getUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** The church the signed-in user works in, or null if they haven't set one up. */
export const getChurchForUser = cache(async (userId: string) => {
  const [row] = await db
    .select({ church: schema.church, role: schema.staff.role })
    .from(schema.staff)
    .innerJoin(schema.church, eq(schema.staff.churchId, schema.church.id))
    .where(and(eq(schema.staff.userId, userId), eq(schema.staff.status, "active")))
    .limit(1);
  return row ?? null;
});

/** Use in every app page and server action: guarantees a user and their church. */
export async function requireChurch() {
  const user = await requireUser();
  const row = await getChurchForUser(user.id);
  if (!row) redirect("/setup-church");
  return { user, church: row.church, role: row.role };
}
