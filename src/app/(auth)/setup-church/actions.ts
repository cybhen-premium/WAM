"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getChurchForUser, requireUser } from "@/lib/session";

export type SetupState = { error?: string } | undefined;

export async function createChurch(_prev: SetupState, form: FormData): Promise<SetupState> {
  const user = await requireUser();
  if (await getChurchForUser(user.id)) redirect("/dashboard");

  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Church name is required." };
  const opt = (k: string) => String(form.get(k) ?? "").trim() || null;

  // Only keep a referral code that belongs to a real church.
  let referredBy = opt("referralCode")?.toUpperCase() ?? null;
  if (referredBy) {
    const [ref] = await db
      .select({ id: schema.church.id })
      .from(schema.church)
      .where(eq(schema.church.referralCode, referredBy))
      .limit(1);
    if (!ref) return { error: "That referral code wasn't found. Check it or leave it blank." };
  } else referredBy = null;

  const [church] = await db
    .insert(schema.church)
    .values({
      name,
      pastorName: opt("pastorName"),
      phone: opt("phone"),
      location: opt("location"),
      denominationCode: opt("denominationCode"),
      referredBy,
      ownerId: user.id,
    })
    .returning({ id: schema.church.id });

  await db.insert(schema.staff).values({
    churchId: church.id,
    userId: user.id,
    email: user.email,
    role: "admin",
    status: "active",
  });

  redirect("/dashboard");
}

/** Accepts a pending staff invitation addressed to the signed-in user's email. */
export async function acceptInvite(staffId: string) {
  const user = await requireUser();
  await db
    .update(schema.staff)
    .set({ userId: user.id, status: "active" })
    .where(
      and(
        eq(schema.staff.id, staffId),
        eq(schema.staff.email, user.email.toLowerCase()),
        eq(schema.staff.status, "pending"),
        isNull(schema.staff.userId),
      ),
    );
  redirect("/dashboard");
}
